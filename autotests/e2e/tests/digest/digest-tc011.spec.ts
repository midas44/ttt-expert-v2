import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc011Data } from "@data/digest/DigestTc011Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  fireSoonIso,
} from "@utils/clockControl";

/**
 * TC-DIGEST-011 (Variant A — scheduler): Russian plural-form edge cases.
 *
 * **STATUS (session 142): XLSX PREMISE INVALID — test will always fail.**
 *
 * Empirical verification of the `ttt_email.email_template WHERE code='DIGEST'`
 * row and every branch of the Mustache body confirmed that the digest template
 * has **no** Russian plural-form rendering. Every per-employee-per-vacation
 * row uses a fixed literal prefix:
 *
 *     <div>{{startDate}} – {{endDate}}, <b>дней: {{daysCount}}</b></div>
 *
 * `{{daysCount}}` is an integer substituted verbatim; `дней:` never morphs to
 * `день` / `дня`. The XLSX TC "Russian plural-form edge cases (1 день / 2 дня
 * / 5 дней / 21 день)" tests functionality that does not exist.
 *
 * Full analysis: `exploration/tickets/digest-template-reality-session-142.md`.
 *
 * Recommended revision (human review required — do not silently rewrite):
 *   - Rescope as "per-event block content-complete" — assert `дней: <N>` for
 *     each seeded vacation, where `<N>` is the working-day count (not calendar
 *     days — `daysCount` excludes weekends + holidays).
 *   - OR delete the TC and author plural-form coverage against a different
 *     code path (email-notification-helpers / vacation-confirmation templates
 *     where morphology actually exists).
 *
 * The spec body is retained unchanged from the original draft so the failure
 * is loud and obvious when someone re-runs it. DO NOT "fix" it by matching
 * `дней: N` — that would silently move the goalposts away from the XLSX
 * requirement.
 *
 * Collision note (retained from original, irrelevant given the above but kept
 * for context): the naive substring `"1 день"` also matches inside
 * `"21 день"`. Assertions use negative-lookbehind regexes `/(?<!\d)1 день/`
 * to force a standalone match.
 */
test("TC-DIGEST-011: Digest (scheduler) — Russian plural-form edge cases @regress @digest @col-digest", async ({
  request,
}) => {
  // Scheduler digest on shared QA env iterates every employee; allow 7 min
  // end-to-end (marker wait + email dispatch).
  test.setTimeout(420_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc011Data.create(tttConfig);
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
  } finally {
    await resetServerClock(request, tttConfig).catch(() => {});
    await data.cleanup(request, tttConfig);
  }
});
