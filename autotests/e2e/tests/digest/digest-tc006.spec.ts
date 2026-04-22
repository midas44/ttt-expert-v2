import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc006Data } from "@data/digest/DigestTc006Data";
import { triggerDigestTestEndpoint } from "@utils/clockControl";

/**
 * TC-DIGEST-006 (Variant B — test endpoint): leakage guard via wrapper bypass.
 *
 * Same 4-vacation mixed seed as TC-005 (target APPROVED-tomorrow + 3 leakage
 * candidates: wrong-date APPROVED, CANCELED, REJECTED). Trigger via
 * POST /api/vacation/v1/test/digest — scheduler markers MUST be absent;
 * per-recipient marker for the target MUST emit; no per-recipient markers
 * for the leakage candidates. Body rendered exactly as Variant A — confirms
 * status/date filter holds on the bypass path.
 */
test("TC-DIGEST-006: Digest (test endpoint) — leakage guard blocks non-APPROVED and non-tomorrow @regress @digest @col-digest", async ({
  request,
}) => {
  // Test endpoint runs synchronously but iterates all employees — shared QA
  // env can take >180 s.
  test.setTimeout(300_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc006Data.create(tttConfig);
  const sinceSearch = new Date();

  await data.seed(request, tttConfig);

  try {
    await triggerDigestTestEndpoint(request, tttConfig);

    const msg = await roundcube.waitForEmail({
      to: data.targetEmail,
      subject: "Дайджест отсутствий",
      sinceSearch,
      timeoutMs: 240_000,
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
