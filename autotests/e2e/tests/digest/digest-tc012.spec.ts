import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc012Data } from "@data/digest/DigestTc012Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  nextMondayDateIso,
  triggerDigestTestEndpoint,
} from "@utils/clockControl";

/**
 * TC-DIGEST-012 (Variant B — test endpoint): Russian plural-form edge cases.
 *
 * **STATUS (session 142): XLSX PREMISE INVALID — test will always fail.**
 *
 * See TC-DIGEST-011's doc comment and
 * `exploration/tickets/digest-template-reality-session-142.md` for the full
 * investigation. The DIGEST Mustache template uses a fixed `дней: {{daysCount}}`
 * pattern and never morphs the day-word — so the four plural branches the
 * XLSX enumerates cannot be exercised.
 *
 * Same 4-vacation seed pattern as TC-DIGEST-011 but triggered through
 * `POST /api/vacation/v1/test/digest`. The test endpoint bypasses ONLY the
 * `@Scheduled` wrapper (scheduler markers, ShedLock, exception catch); the
 * internal Monday gate inside `DigestServiceImpl.addSoonVacationEvents`
 * (`today.getDayOfWeek() == MONDAY`) applies to BOTH paths, so this variant
 * still patches the clock to next Monday at 12:00.
 *
 * Blocked pending XLSX revision — see TC-011 doc for recommended repurposing.
 * Spec body retained unchanged from the draft so re-runs fail loudly.
 */
test("TC-DIGEST-012: Digest (test endpoint) — Russian plural-form edge cases @regress @digest @col-digest", async ({
  request,
}) => {
  // Test endpoint runs synchronously and iterates every employee on shared QA;
  // on Monday the `addSoonVacationEvents` path adds substantial work (scans
  // all upcoming APPROVED vacations for all employees). Allow 7 min total:
  // 4 min for the POST, 2 min for email IMAP polling, buffer for cleanup.
  test.setTimeout(420_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc012Data.create(tttConfig);
  const sinceSearch = new Date();

  const serverTimeBefore = await getServerClock(request, tttConfig);
  const mondayIso = nextMondayDateIso(serverTimeBefore);
  const patchIso = `${mondayIso}T12:00:00`;

  let clockPatched = false;
  try {
    await patchServerClock(request, tttConfig, patchIso);
    clockPatched = true;
    await data.seed(request, tttConfig);

    await triggerDigestTestEndpoint(request, tttConfig, { timeoutMs: 240_000 });

    const msg = await roundcube.waitForEmail({
      to: data.seedEmail,
      subject: "Дайджест отсутствий",
      sinceSearch,
      timeoutMs: 120_000,
      intervalMs: 10_000,
    });

    const envTag = tttConfig.envTag;
    const subjectPattern = new RegExp(`^\\[${envTag}\\]ТТТ Дайджест отсутствий$`);
    roundcube.assertSubject(msg, subjectPattern);

    const body = roundcube.read(msg.uid);
    const bodyText = body.text_body ?? "";

    const displayFirst = data.seedRussianFirstName || data.seedLatinFirstName;
    const displayLast = data.seedRussianLastName || data.seedLatinLastName;

    roundcube.assertBodyContains(
      body,
      `Здравствуйте, ${displayFirst} ${displayLast}`,
      data.seeds[0].startDisplay,
      data.seeds[1].startDisplay,
      data.seeds[1].endDisplay,
      data.seeds[2].startDisplay,
      data.seeds[2].endDisplay,
      data.seeds[3].startDisplay,
      data.seeds[3].endDisplay,
    );

    const correctForms: Array<{ probe: RegExp; label: string }> = [
      { probe: /(?<!\d)1 день(?![а-яё])/u, label: "1 день (1-day branch)" },
      { probe: /(?<!\d)2 дня(?![а-яё])/u, label: "2 дня (2-day branch)" },
      { probe: /(?<!\d)5 дней(?![а-яё])/u, label: "5 дней (5-day branch)" },
      { probe: /(?<!\d)21 день(?![а-яё])/u, label: "21 день (…1 after teens-exclusion)" },
    ];
    for (const { probe, label } of correctForms) {
      expect(
        bodyText,
        `digest body must contain ${label} — matched by ${probe}`,
      ).toMatch(probe);
    }

    const wrongForms: Array<{ probe: RegExp; label: string }> = [
      { probe: /(?<!\d)1 дня(?![а-яё])/u, label: "1 дня (wrong for 1-day)" },
      { probe: /(?<!\d)1 дней(?![а-яё])/u, label: "1 дней (wrong for 1-day)" },
      { probe: /(?<!\d)2 день(?![а-яё])/u, label: "2 день (wrong for 2-day)" },
      { probe: /(?<!\d)2 дней(?![а-яё])/u, label: "2 дней (wrong for 2-day)" },
      { probe: /(?<!\d)5 день(?![а-яё])/u, label: "5 день (wrong for 5-day)" },
      { probe: /(?<!\d)5 дня(?![а-яё])/u, label: "5 дня (wrong for 5-day)" },
      { probe: /(?<!\d)21 дня(?![а-яё])/u, label: "21 дня (wrong for 21-day)" },
      { probe: /(?<!\d)21 дней(?![а-яё])/u, label: "21 дней (wrong for 21-day)" },
    ];
    for (const { probe, label } of wrongForms) {
      expect(
        bodyText,
        `digest body must NOT contain ${label} — matched by ${probe}`,
      ).not.toMatch(probe);
    }

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
    if (clockPatched) {
      await resetServerClock(request, tttConfig).catch(() => {});
    }
    await data.cleanup(request, tttConfig).catch(() => {});
  }
});
