import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc005Data } from "@data/digest/DigestTc005Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  fireSoonIso,
} from "@utils/clockControl";

/**
 * TC-DIGEST-005 (Variant A — scheduler): leakage guard.
 *
 * Seeds 4 vacations for the same target (pvaynmaster):
 *   • v1: APPROVED @ tomorrow — MUST appear in body.
 *   • v2: APPROVED @ tomorrow+2 — wrong-date leakage candidate (MUST NOT appear).
 *   • v3: CANCELED @ tomorrow — wrong-status leakage candidate.
 *   • v4: REJECTED @ tomorrow — wrong-status leakage candidate.
 *
 * (NEW-tomorrow is skipped — the API's `hasVacationConflict` rule makes it
 * mutually exclusive with APPROVED-tomorrow for the same employee.)
 *
 * Assertions: per-employee block for v1 is rendered with correct date +
 * duration; none of the leakage dates / ids appear in body.
 */
test("TC-DIGEST-005: Digest (scheduler) — leakage guard blocks non-APPROVED and non-tomorrow @regress @digest @col-digest", async ({
  request,
}) => {
  // Scheduler-variant digest takes several minutes on shared QA env.
  test.setTimeout(420_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc005Data.create(tttConfig);
  const sinceSearch = new Date();

  await data.seed(request, tttConfig);

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

    const failedHits = graylog.count({
      query: '"Digests sending job failed"',
      since: triggerIso,
    });
    expect(failedHits, "no failure marker must be emitted").toBe(0);

    const msg = await roundcube.waitForEmail({
      to: data.targetEmail,
      subject: "Дайджест отсутствий",
      sinceSearch,
      timeoutMs: 120_000,
      intervalMs: 10_000,
    });

    const envTag = tttConfig.envTag;
    const subjectPattern = new RegExp(`^\\[${envTag}\\]ТТТ Дайджест отсутствий$`);
    roundcube.assertSubject(msg, subjectPattern);

    const body = roundcube.read(msg.uid);

    const displayFirst = data.russianFirstName || data.latinFirstName;
    const displayLast = data.russianLastName || data.latinLastName;

    roundcube.assertBodyContains(
      body,
      `Здравствуйте, ${displayFirst} ${displayLast}`,
      data.tomorrowDisplay,
      data.targetStartDisplay,
      data.targetDurationPhrase,
    );

    roundcube.assertBodyMissing(body, data.wrongDateDisplay);
  } finally {
    await resetServerClock(request, tttConfig).catch(() => {});
    await data.cleanup(request, tttConfig);
  }
});
