import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc007Data } from "@data/digest/DigestTc007Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  fireSoonIso,
} from "@utils/clockControl";

/**
 * TC-DIGEST-007 (Variant A — scheduler): subject-format regex audit.
 *
 * Envelope-only TC. Asserts the delivered subject is exactly
 * `[<ENV>]ТТТ Дайджест отсутствий` where:
 *   • the three ТТТ characters are Cyrillic U+0422 (Te), NOT Latin U+0054.
 *   • the Latin `[<ENV>][TTT] ` bracketed pattern used by every other TTT
 *     template does NOT match — the digest subject is anomalous in stripping
 *     the inner brackets and localising the service tag.
 *   • no trailing date / data is appended.
 */
const CYRILLIC_TE = "Т"; // Cyrillic Capital Letter Te (ТТТ)
const LATIN_T = "T"; // Latin Capital Letter T

test("TC-DIGEST-007: Digest (scheduler) — subject format [<ENV>]ТТТ Дайджест отсутствий @regress @digest @col-digest", async ({
  request,
}) => {
  // Scheduler-variant digest takes several minutes on shared QA env.
  test.setTimeout(420_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc007Data.create(tttConfig);
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

    const msg = await roundcube.waitForEmail({
      to: data.seedEmail,
      subject: "Дайджест отсутствий",
      sinceSearch,
      timeoutMs: 120_000,
      intervalMs: 10_000,
    });

    const envTag = tttConfig.envTag;
    const expectedSubject = `[${envTag}]${CYRILLIC_TE}${CYRILLIC_TE}${CYRILLIC_TE} Дайджест отсутствий`;
    const subject = msg.subject ?? "";

    expect(
      subject,
      `subject must be exactly '${expectedSubject}' (Cyrillic ТТТ, no inner brackets, no trailing data)`,
    ).toBe(expectedSubject);

    const positivePattern = new RegExp(`^\\[${envTag}\\]${CYRILLIC_TE}{3} Дайджест отсутствий$`);
    roundcube.assertSubject(msg, positivePattern);

    const latinBracketedPattern = new RegExp(`^\\[${envTag}\\]\\[${LATIN_T}{3}\\] `);
    expect(
      latinBracketedPattern.test(subject),
      `subject must NOT match Latin bracketed pattern '[<ENV>][TTT] ' — digest is anomalous`,
    ).toBe(false);

    const afterEnvClose = subject.indexOf("]") + 1;
    const serviceTag = subject.slice(afterEnvClose, afterEnvClose + 3);
    expect(
      serviceTag.length,
      "service tag slice must have length 3 (either Cyrillic ТТТ or Latin TTT)",
    ).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(
        serviceTag.charCodeAt(i),
        `service-tag char ${i} must be Cyrillic Te U+0422, not Latin T U+0054`,
      ).toBe(0x0422);
    }

    expect(
      /^TTT/.test(serviceTag),
      "ASCII /^TTT/ must NOT match the service tag — it is Cyrillic",
    ).toBe(false);
  } finally {
    await resetServerClock(request, tttConfig).catch(() => {});
    await data.cleanup(request, tttConfig);
  }
});
