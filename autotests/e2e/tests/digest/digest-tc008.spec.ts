import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { DigestTc008Data } from "@data/digest/DigestTc008Data";
import { triggerDigestTestEndpoint } from "@utils/clockControl";

/**
 * TC-DIGEST-008 (Variant B — test endpoint): subject-format regex audit.
 *
 * Identical envelope assertions to TC-007 but triggered via
 * POST /api/vacation/v1/test/digest. Confirms envelope composition is not
 * wrapper-dependent — if Variant A shows Cyrillic but Variant B shows Latin
 * (or vice-versa), the subject is composed at different layers and that is a
 * defect.
 */
const CYRILLIC_TE = "Т"; // Cyrillic Capital Letter Te (ТТТ)
const LATIN_T = "T"; // Latin Capital Letter T

test("TC-DIGEST-008: Digest (test endpoint) — subject format [<ENV>]ТТТ Дайджест отсутствий @regress @digest @col-digest", async ({
  request,
}) => {
  // Test endpoint runs synchronously but iterates all employees — shared QA
  // env can take >180 s.
  test.setTimeout(300_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const data = await DigestTc008Data.create(tttConfig);
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
    await data.cleanup(request, tttConfig);
  }
});
