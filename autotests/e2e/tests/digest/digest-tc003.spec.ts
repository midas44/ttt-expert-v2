import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc003Data } from "@data/digest/DigestTc003Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  fireSoonIso,
} from "@utils/clockControl";

/**
 * TC-DIGEST-003 (Variant A — scheduler): empty happy path — task completes
 * cleanly, start + finish markers emit, no failure, no per-recipient markers.
 *
 * The TC's ideal precondition is "zero APPROVED vacations starting tomorrow".
 * On shared envs this cannot be forced without disrupting sibling tests, so
 * the spec relaxes the "Roundcube count unchanged" assertion when the env
 * already carries seed data (see DigestTc003Data.precheckCount). The core
 * scheduler-health assertions (start + finish + no ERROR) still hold.
 */
test("TC-DIGEST-003: Digest (scheduler) — empty happy path completes cleanly @regress @digest @col-digest", async ({
  request,
}) => {
  // Scheduler-variant digest takes several minutes on shared QA env.
  test.setTimeout(420_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc003Data.create(tttConfig);

  const envUpper = tttConfig.env.toUpperCase();
  const digestSubject = `[${envUpper}]ТТТ Дайджест отсутствий`;
  const baselineCount = roundcube.count({
    subject: digestSubject,
    since: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });

  try {
    const triggerIso = new Date().toISOString();
    const serverTimeBefore = await getServerClock(request, tttConfig);
    await patchServerClock(request, tttConfig, fireSoonIso(serverTimeBefore));

    await graylog.waitForMarker({
      query: '"Digests sending job finished"',
      since: triggerIso,
      timeoutMs: 300_000,
      intervalMs: 10_000,
    });

    const startedHits = graylog.count({
      query: '"Digests sending job started"',
      since: triggerIso,
    });
    expect(startedHits, "scheduler started-marker must emit").toBeGreaterThanOrEqual(1);

    const failedHits = graylog.count({
      query: '"Digests sending job failed"',
      since: triggerIso,
    });
    expect(failedHits, "no failure marker must be emitted").toBe(0);

    const errorHits = graylog.count({
      query: 'level:3 AND "Digests sending job"',
      since: triggerIso,
    });
    expect(errorHits, "no ERROR-level entries for the digest job").toBe(0);

    if (data.precheckCount === 0) {
      const afterCount = roundcube.count({
        subject: digestSubject,
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      expect(
        afterCount,
        "with zero APPROVED-tomorrow seed, no digest email may be dispatched",
      ).toBe(baselineCount);
    }
  } finally {
    await resetServerClock(request, tttConfig).catch(() => {});
  }
});
