import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ClockFixture } from "@common/fixtures/ClockFixture";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";

/**
 * TC-3414-CORNER-01 — Day-off on 1st of month, "today" mid-month.
 *
 * Exercises the exact pre-fix buggy branch: `moment().isAfter(moment(originalDate))`.
 * On a real wall-clock earlier than `originalDate`, that branch never fires — so
 * the only way to reproduce the faulty `minDate` was either to shift the server
 * clock past originalDate, or (as we did in Stage D) reduce approvePeriod.start
 * to pull the comparison into the other branch. This spec uses the clean
 * clock-advance approach.
 *
 * Data: dmaslov (Venera / AV=false) has an untransferred day-off on
 * 2026-05-01 (Labour Day, Friday) — employee_dayoff id 5516. Venera's
 * approvePeriod.start is 2026-04-01.
 *
 * Clock target: 2026-05-15T10:00:00 — mid-May, safely past Labour Day and
 * within Venera's open approve period so the edit icon remains visible.
 *
 * Expected post-fix: minDate = 2026-05-01 (startOf('month') of originalDate).
 * → All April cells disabled (including Apr 30), May 1 is the first selectable.
 *
 * Pre-fix behaviour: minDate = 2026-04-01 (approvePeriod.start, un-floored) →
 * all of April selectable. This spec asserts the post-fix behaviour.
 */
test("TC-3414-CORNER-01: 1st-of-month day-off with mid-month clock @regress @t3414 @clock", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(180_000);

  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const verification = new VerificationFixture(page, globalConfig);

  const clock = new ClockFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, "dmaslov", globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOff = new DayOffPage(page);

  const clockTarget = "2026-05-15T10:00:00";
  const dateDisplay = "01.05.2026";

  try {
    // 1. Patch FE + BE clock BEFORE any navigation so React boots under the
    //    virtual clock and the backend sees the same instant when rendering
    //    approvePeriod / is-open responses.
    await clock.setBoth(page, clockTarget);
    const echoed = await clock.getBackend();
    // Backend echoes a LocalDateTime within seconds of our target
    expect(echoed.startsWith("2026-05-15")).toBe(true);

    // 2. Standard login + navigation. The CAS SSO flow works under the fake
    //    clock because cookies / JWT handshake times align: page.clock is the
    //    authoritative "now" for the browser, and the CAS server reads its own
    //    real clock (JWT still validates as we're well inside token lifetime).
    await globalConfig.applyViewport(page);
    await login.run();
    await dayOff.goto(tttConfig.appUrl);
    await dayOff.waitForReady();
    await verification.captureStep(testInfo, "day-off-tab-loaded-clock-may15");

    // 3. The 01.05.2026 row should be visible and still editable — the row is
    //    in the open approve period (Venera: 2026-04-01) and after post-fix
    //    minDate handling, the icon visibility is unchanged.
    const row = dayOff.dayOffRow(dateDisplay);
    await expect(row.first()).toBeVisible({
      timeout: globalConfig.stepTimeoutMs,
    });
    expect(await dayOff.hasEditButton(dateDisplay)).toBe(true);

    // 4. Open the TransferDaysoffModal. This is the bug's surface.
    await dayOff.clickEditButton(dateDisplay);
    await verification.captureStep(testInfo, "transfer-modal-opened");

    // 5. Assertions on the datepicker:
    //    - April 30 (the day BEFORE originalDate's month) must be disabled
    //    - May 1 (originalDate) must be selectable
    //    - May 5 (a random in-month workday) must be selectable
    //
    // The react-datetime picker renders each day cell as a <td> with class
    // `rdtDay` (enabled) or `rdtDay rdtDisabled` (disabled). The calendar may
    // show April cells as "prev-month bleed" — assert by visible day text +
    // aria-label / text match to avoid collisions across months.
    const calendar = page.locator(".rdtPicker");
    await calendar.first().waitFor({ state: "visible", timeout: 15_000 });

    // Helper: count enabled/disabled cells for April across the rendered grid.
    // React-datetime shows days of the current visible month (May when we
    // opened on 2026-05-15) plus prev-month bleed (late April) on the top row.
    const aprilCells = calendar
      .locator("td.rdtDay.rdtOld")
      .filter({ hasText: /^(2[5-9]|30)$/ });
    const aprilEnabled = await aprilCells
      .evaluateAll((cells: Element[]) =>
        cells.filter((c) => !c.classList.contains("rdtDisabled")).length,
      );
    expect(
      aprilEnabled,
      "All April cells in the prev-month bleed must be disabled (post-fix minDate = 2026-05-01)",
    ).toBe(0);

    // May 1 must be present in the current-month grid and NOT disabled.
    const may1 = calendar
      .locator("td.rdtDay:not(.rdtOld):not(.rdtNew)")
      .filter({ hasText: /^1$/ })
      .first();
    await expect(may1).toBeVisible();
    const may1Disabled = (await may1.getAttribute("class"))?.includes("rdtDisabled");
    expect(
      may1Disabled,
      "May 1 (1st of originalDate's month) must be selectable",
    ).toBeFalsy();

    // May 5 — known Tuesday, workday, must be selectable
    const may5 = calendar
      .locator("td.rdtDay:not(.rdtOld):not(.rdtNew)")
      .filter({ hasText: /^5$/ })
      .first();
    const may5Disabled = (await may5.getAttribute("class"))?.includes("rdtDisabled");
    expect(may5Disabled, "May 5 must be selectable").toBeFalsy();

    await verification.captureStep(testInfo, "datepicker-april-disabled-may-enabled");
  } finally {
    // Cleanup: restore BOTH clocks. Backend reset is critical on shared envs —
    // leaving it shifted breaks every other scheduled-job test.
    await clock.restore(page).catch(() => {});
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});

/**
 * TC-3414-CORNER-02 — Weekend-on-1st scenario (DEFERRED).
 *
 * Analytically covered by TC-CORNER-01: the `minDate` formula is
 * `startOf('month')` of the originalDate, which is weekend-agnostic. If
 * originalDate falls on a Saturday 1st (e.g. 2026-08-01), startOf('month')
 * still yields 2026-08-01 — the weekend-ness doesn't change the floor.
 *
 * Full weekend-1st coverage would need DB seeding of a day-off on a
 * weekend-1st date AND a matching production-calendar "red day" so the
 * `renderDay` weekend gating doesn't independently disable that cell. Neither
 * qa-1 nor stage has such a record today. Skipped for this round; re-file
 * if regressions appear in weekend-adjacent calendar rendering.
 */
test.skip("TC-3414-CORNER-02: Weekend-on-1st scenario (deferred) @t3414", () => {
  // no-op
});
