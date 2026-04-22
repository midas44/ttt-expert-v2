import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc013Data } from "@data/digest/DigestTc013Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  nextMondayDec31Year,
} from "@utils/clockControl";

/**
 * TC-DIGEST-013 (Variant A — scheduler): cross-year boundary.
 *
 * **STATUS (session 142): core premise VALID, spec fail-shape INVALID.**
 *
 * The date-format premise (`DateFormatter.formatDateMonthYear` emits
 * `dd.MM.yyyy`, year rolls over correctly from `<targetYear>` to
 * `<targetYear+1>` when `CURRENT_DATE` is 31-Dec) is verified and does
 * exercise real code. But the spec's email assertion looks for
 * `to: pvaynmaster.email`, which cannot match: the digest recipient is
 * `employee.manager` (or an optional approver), never the vacation employee
 * themselves. See `exploration/tickets/digest-template-reality-session-142.md`
 * for the empirical evidence.
 *
 * Required revisions (human/Phase-B review — do not silently rewrite):
 *   1. Resolve `pvaynmaster.manager.email` (`ilnitsky@noveogroup.com`, id 65)
 *      via DB and search that mailbox for the arriving digest.
 *   2. Drop the `Здравствуйте, ${displayFirst} ${displayLast}` assertion —
 *      the DIGEST template opens with a static `"Добрый день!"` and never
 *      personalises the greeting with the recipient name.
 *   3. Assert body contains the seed employee's Russian display name
 *      (`Павел Вайнмастер`) alongside `01.01.<targetYear+1>` /
 *      `05.01.<targetYear+1>` — the employee name appears under the
 *      soonAbsence / approve table row for their own vacation.
 *
 * Additional operational risk: advancing the clock 2.6 years into the future
 * on a shared QA-1 env affects every concurrent request for the duration of
 * the test. Before re-enabling, either (a) guard with a mutex on the env or
 * (b) only run on TIMEMACHINE.
 *
 * Spec body retained unchanged from the draft so re-runs fail loudly.
 *
 * Clock-patch scheme (retained for reference):
 *   1. Patch to `<targetYear>-12-31T00:30:00` (safe early Monday morning).
 *   2. Seed vacation (API validates start date against patched clock).
 *   3. Re-patch to `<targetYear>-12-31T07:59:55` so scheduler fires within
 *      seconds of the subsequent waitForMarker().
 */
test("TC-DIGEST-013: Digest (scheduler) — cross-year boundary renders next year correctly @regress @digest @col-digest", async ({
  request,
}) => {
  // Two clock patches + scheduler wait + email dispatch on shared QA env.
  // Budget 7 min end-to-end.
  test.setTimeout(420_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc013Data.create(tttConfig);
  const sinceSearch = new Date();

  const serverTimeBefore = await getServerClock(request, tttConfig);
  const targetYear = nextMondayDec31Year(serverTimeBefore);
  const nextYear = targetYear + 1;
  const earlyPatchIso = `${targetYear}-12-31T00:30:00`;
  const firePatchIso = `${targetYear}-12-31T07:59:55`;

  let clockPatched = false;
  try {
    await patchServerClock(request, tttConfig, earlyPatchIso);
    clockPatched = true;
    await data.seed(request, tttConfig, targetYear);

    const triggerIso = new Date().toISOString();
    await patchServerClock(request, tttConfig, firePatchIso);

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
    const bodyText = body.text_body ?? "";

    const displayFirst = data.seedRussianFirstName || data.seedLatinFirstName;
    const displayLast = data.seedRussianLastName || data.seedLatinLastName;

    roundcube.assertBodyContains(
      body,
      `Здравствуйте, ${displayFirst} ${displayLast}`,
      `01.01.${nextYear}`,
      `05.01.${nextYear}`,
      data.durationPhrase,
    );

    const wrongYearPattern = new RegExp(`\\d{2}\\.\\d{2}\\.${targetYear}(?!\\d)`);
    expect(
      bodyText,
      `digest body must NOT contain any date field with the current year (${targetYear}) — all rendered dates should use ${nextYear}`,
    ).not.toMatch(wrongYearPattern);
  } finally {
    if (clockPatched) {
      await resetServerClock(request, tttConfig).catch(() => {});
    }
    await data.cleanup(request, tttConfig).catch(() => {});
  }
});
