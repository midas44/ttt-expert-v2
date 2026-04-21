import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc002Data } from "@data/digest/DigestTc002Data";
import { triggerDigestTestEndpoint } from "@utils/clockControl";

/**
 * TC-DIGEST-002 (Variant B — test endpoint): APPROVED vacation starting
 * tomorrow, content-complete email + wrapper-bypass signature (scheduler
 * markers ABSENT).
 *
 * Flow: seed one APPROVED-tomorrow vacation → POST /api/vacation/v1/test/digest
 * (bypasses @Scheduled wrapper) → wait 30 s for email dispatch → assert every
 * dynamic field → assert scheduler start/finish markers did NOT emit →
 * cleanup.
 */
test("TC-DIGEST-002: Digest (test endpoint) — APPROVED tomorrow vacation content-complete @regress @digest @col-digest", async ({
  request,
}) => {
  // Test endpoint bypasses the @Scheduled wrapper but the digest itself
  // iterates over every employee — on shared QA env that exceeds the default
  // 180 s budget. Allow 5 min.
  test.setTimeout(300_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc002Data.create(tttConfig);
  const sinceSearch = new Date();

  await data.seed(request, tttConfig);

  try {
    await triggerDigestTestEndpoint(request, tttConfig);

    const msg = await roundcube.waitForEmail({
      to: data.seedEmail,
      subject: "Дайджест отсутствий",
      sinceSearch,
      timeoutMs: 240_000,
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

    await graylog.assertAbsent({
      query: '"Digests sending job started"',
      range: "5m",
      settleMs: 5_000,
    });
    await graylog.assertAbsent({
      query: '"Digests sending job finished"',
      range: "5m",
      settleMs: 2_000,
    });
  } finally {
    await data.cleanup(request, tttConfig);
  }
});
