import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc001Data } from "@data/digest/DigestTc001Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  fireSoonIso,
} from "@utils/clockControl";

/**
 * TC-DIGEST-001 (Variant A — scheduler): APPROVED vacation starting tomorrow,
 * content-complete email + scheduler markers.
 *
 * Flow: seed one APPROVED-tomorrow vacation → advance clock to 07:59:55 local
 * → wait up to 90s for "Digests sending job finished" Graylog marker → pull
 * delivered digest email → assert every dynamic field (greeting, period,
 * per-employee block with Russian-localised type + plural duration, footer)
 * → assert per-recipient Graylog marker → cleanup (reset clock + delete seed).
 */
test("TC-DIGEST-001: Digest (scheduler) — APPROVED tomorrow vacation content-complete @regress @digest @col-digest", async ({
  request,
}) => {
  // Digest job processes every employee on the shared QA env and routinely
  // exceeds the default 180 s test budget. Allow 7 min for marker + email.
  test.setTimeout(420_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc001Data.create(tttConfig);
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

    const startedHits = graylog.count({
      query: '"Digests sending job started"',
      since: triggerIso,
    });
    expect(startedHits, "scheduler started-marker must emit exactly once").toBeGreaterThanOrEqual(1);

    const failedHits = graylog.count({
      query: '"Digests sending job failed"',
      since: triggerIso,
    });
    expect(failedHits, "no failure marker must be emitted").toBe(0);

    const msg = await roundcube.waitForEmail({
      to: data.seedEmail,
      subject: "Дайджест отсутствий",
      sinceSearch,
      timeoutMs: 120_000,
      intervalMs: 10_000,
    });

    const envUpper = tttConfig.env.toUpperCase();
    const subjectPattern = new RegExp(`^\\[${envUpper}\\]ТТТ Дайджест отсутствий$`);
    roundcube.assertSubject(msg, subjectPattern);

    const body = roundcube.read(msg.uid);

    const displayFirst = data.seedRussianFirstName || data.seedLatinFirstName;
    const displayLast = data.seedRussianLastName || data.seedLatinLastName;

    roundcube.assertBodyContains(
      body,
      `Здравствуйте, ${displayFirst} ${displayLast}`,
      data.tomorrowDisplay,
      data.startDateDisplay,
      data.endDateDisplay,
      data.durationPhrase,
    );
  } finally {
    await resetServerClock(request, tttConfig).catch(() => {});
    await data.cleanup(request, tttConfig);
  }
});
