import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc010Data } from "@data/digest/DigestTc010Data";
import { triggerDigestTestEndpoint } from "@utils/clockControl";

/**
 * TC-DIGEST-010 (Variant B — test endpoint): Graylog marker audit.
 *
 * Pair of TC-009. Triggers the digest via POST /api/vacation/v1/test/digest
 * which bypasses the @Scheduled wrapper. Asserts:
 *   • `"Digests sending job started"`  — 0 hits since trigger (wrapper bypass).
 *   • `"Digests sending job finished"` — 0 hits since trigger (wrapper bypass).
 *   • `"Digests sending job failed"`   — 0 hits since trigger.
 *   • Level-3 ERROR entries correlated with digest run since trigger — 0.
 *
 * No per-recipient marker assertion: `DigestServiceImpl` and its formatters
 * emit zero log statements; only `DigestScheduler` writes the started/finished
 * /failed wrapper markers. Per-recipient delivery is covered by the Roundcube
 * email checks in the body-content TCs (TC-002/006/008).
 *
 * The wrapper-bypass invariant is the load-bearing assertion: if scheduler
 * markers DO appear in the post-trigger window, the test endpoint is
 * incorrectly going through the @Scheduled wrapper (or an unrelated scheduler
 * fire happened to land in our window — re-run on a quieter env to
 * disambiguate).
 *
 * Synchronisation: POST /v1/test/digest is synchronous — the response returns
 * after `digestService.sendDigests()` completes. We give Graylog ~10 s to
 * flush before asserting absence/error counts.
 *
 * Range scoping: all assertions use `since: triggerIso` (the absolute
 * timestamp captured pre-trigger) instead of a relative range. This narrows
 * the window so unrelated scheduler runs from before the trigger don't
 * pollute the absence assertions.
 */
test("TC-DIGEST-010: Digest (test endpoint) — Graylog marker audit @regress @digest @col-digest", async ({
  request,
}) => {
  // Test endpoint runs synchronously but iterates all employees — shared QA
  // env can take >180 s.
  test.setTimeout(300_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc010Data.create(tttConfig);

  await data.seed(request, tttConfig);

  try {
    const triggerIso = new Date().toISOString();
    await triggerDigestTestEndpoint(request, tttConfig);

    // POST is synchronous — the response returns after the digest service
    // finishes. Give Graylog ~10 s to index any wrapper markers that would
    // disprove the wrapper-bypass invariant.
    await new Promise((r) => setTimeout(r, 10_000));

    await graylog.assertAbsent({
      query: '"Digests sending job started"',
      since: triggerIso,
      settleMs: 2_000,
    });

    await graylog.assertAbsent({
      query: '"Digests sending job finished"',
      since: triggerIso,
      settleMs: 2_000,
    });

    const failedHits = graylog.count({
      query: '"Digests sending job failed"',
      since: triggerIso,
    });
    expect(failedHits, "no failure marker must be emitted").toBe(0);

    const errorHits = graylog.count({
      query: 'level:3 AND "Digests sending job"',
      since: triggerIso,
    });
    expect(
      errorHits,
      "no ERROR-level entries correlated with the digest run since trigger",
    ).toBe(0);
  } finally {
    await data.cleanup(request, tttConfig);
  }
});
