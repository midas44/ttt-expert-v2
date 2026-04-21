import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc009Data } from "@data/digest/DigestTc009Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  fireSoonIso,
} from "@utils/clockControl";

/**
 * TC-DIGEST-009 (Variant A — scheduler): Graylog marker audit.
 *
 * Catches scheduler-marker regressions without depending on email delivery.
 *
 * Asserts on the env's Graylog stream:
 *   • `"Digests sending job started"` — at least 1 hit in the post-trigger window.
 *   • `"Digests sending job finished"` — at least 1 hit, finished-timestamp ≥ started.
 *   • `"Digests sending job failed"` — 0 hits.
 *   • Level-3 ERROR entries correlated with the digest run — 0.
 *
 * No per-recipient marker assertion: `DigestServiceImpl` and its formatters
 * emit zero log statements; only `DigestScheduler` writes the started/finished
 * /failed wrapper markers. Per-recipient delivery is covered by Roundcube
 * checks in TC-001/005/007 (Variant A) and TC-002/006/008 (Variant B).
 *
 * Concurrency note: the TC-text-ideal "exactly 1 started / 1 finished" is
 * only safe on a quiet env. On shared envs the scheduler may have fired for
 * other unrelated reasons; the load-bearing invariant is "the scheduler ran
 * cleanly at least once in the post-trigger window with no failure marker".
 */
test("TC-DIGEST-009: Digest (scheduler) — Graylog marker audit @regress @digest @col-digest", async ({
  request,
}) => {
  // Digest job processes every employee on the shared QA env and routinely
  // exceeds the default 180 s test budget — the scheduler ticks every 5 s but
  // the work itself runs for several minutes. Allow 6 min total.
  test.setTimeout(360_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc009Data.create(tttConfig);

  await data.seed(request, tttConfig);

  try {
    const triggerIso = new Date().toISOString();
    const serverTimeBefore = await getServerClock(request, tttConfig);
    await patchServerClock(request, tttConfig, fireSoonIso(serverTimeBefore));

    const finishedHit = await graylog.waitForMarker({
      query: '"Digests sending job finished"',
      since: triggerIso,
      timeoutMs: 300_000,
      intervalMs: 10_000,
    });
    const finishedTs = Date.parse(finishedHit.timestamp);
    expect(
      Number.isFinite(finishedTs),
      `finished-marker timestamp must be parseable (got ${finishedHit.timestamp})`,
    ).toBe(true);

    const startedHits = graylog.search({
      query: '"Digests sending job started"',
      since: triggerIso,
    });
    expect(
      startedHits.length,
      "scheduler started-marker must emit at least once in the post-trigger window",
    ).toBeGreaterThanOrEqual(1);

    const startedTs = Math.min(
      ...startedHits
        .map((h) => Date.parse(h.timestamp))
        .filter((t) => Number.isFinite(t) && t <= finishedTs),
    );
    expect(
      Number.isFinite(startedTs),
      "at least one started-marker must have a timestamp ≤ the finished-marker (ordering invariant)",
    ).toBe(true);
    expect(
      startedTs <= finishedTs,
      `started (${new Date(startedTs).toISOString()}) must precede finished (${new Date(finishedTs).toISOString()})`,
    ).toBe(true);

    const failedHits = graylog.count({
      query: '"Digests sending job failed"',
      since: triggerIso,
    });
    expect(failedHits, "no failure marker must be emitted").toBe(0);

    const errorHits = graylog.count({
      query: 'level:3 AND "Digests sending job"',
      since: triggerIso,
    });
    expect(errorHits, "no ERROR-level entries correlated with the digest run").toBe(0);
  } finally {
    await resetServerClock(request, tttConfig).catch(() => {});
    await data.cleanup(request, tttConfig);
  }
});
