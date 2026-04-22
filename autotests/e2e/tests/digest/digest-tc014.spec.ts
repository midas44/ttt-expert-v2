import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { RoundcubeVerificationFixture } from "@common/fixtures/RoundcubeVerificationFixture";
import { GraylogVerificationFixture } from "@common/fixtures/GraylogVerificationFixture";
import { DigestTc014Data } from "@data/digest/DigestTc014Data";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
  nextMondayDec31Year,
  triggerDigestTestEndpoint,
} from "@utils/clockControl";

/**
 * TC-DIGEST-014 (Variant B — test endpoint): cross-year boundary.
 *
 * **STATUS (session 142): core premise VALID, spec fail-shape INVALID.**
 *
 * Same underlying year-rollover premise as TC-DIGEST-013 — see that spec's
 * doc comment and
 * `exploration/tickets/digest-template-reality-session-142.md` for required
 * revisions (resolve recipient from `pvaynmaster.manager`, drop the
 * `Здравствуйте, …` greeting assertion, assert seed-employee display name
 * in manager's mailbox).
 *
 * Clock patch time-of-day is irrelevant in the endpoint variant (scheduler
 * 08:00 gate bypassed); only the date matters. Seeds same vacation as TC-013
 * and asserts scheduler start/finish markers are absent (wrapper bypass).
 *
 * Spec body retained unchanged from the draft so re-runs fail loudly.
 */
test("TC-DIGEST-014: Digest (test endpoint) — cross-year boundary renders next year correctly @regress @digest @col-digest", async ({
  request,
}) => {
  // Clock patch + synchronous test-endpoint trigger + email dispatch on
  // shared QA env. Budget 5 min.
  test.setTimeout(300_000);

  const tttConfig = new TttConfig();
  new GlobalConfig(tttConfig);
  expect(tttConfig.apiToken, "apiToken must be configured").toBeTruthy();

  const roundcube = new RoundcubeVerificationFixture();
  const graylog = new GraylogVerificationFixture(tttConfig.env);
  const data = await DigestTc014Data.create(tttConfig);
  const sinceSearch = new Date();

  const serverTimeBefore = await getServerClock(request, tttConfig);
  const targetYear = nextMondayDec31Year(serverTimeBefore);
  const nextYear = targetYear + 1;
  const patchIso = `${targetYear}-12-31T12:00:00`;

  let clockPatched = false;
  try {
    await patchServerClock(request, tttConfig, patchIso);
    clockPatched = true;
    await data.seed(request, tttConfig, targetYear);

    await triggerDigestTestEndpoint(request, tttConfig);

    const msg = await roundcube.waitForEmail({
      to: data.seedEmail,
      subject: "Дайджест отсутствий",
      sinceSearch,
      timeoutMs: 240_000,
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
      `01.01.${nextYear}`,
      `05.01.${nextYear}`,
      data.durationPhrase,
    );

    const wrongYearPattern = new RegExp(`\\d{2}\\.\\d{2}\\.${targetYear}(?!\\d)`);
    expect(
      bodyText,
      `digest body must NOT contain any date field with the current year (${targetYear}) — all rendered dates should use ${nextYear}`,
    ).not.toMatch(wrongYearPattern);

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
