import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc014Data } from "../data/DayoffTc014Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffPage } from "../pages/DayOffPage";
import { RescheduleDialog } from "../pages/RescheduleDialog";

/**
 * TC-DO-014: Transfer modal date constraints — max boundary.
 *
 * Opens the reschedule dialog for a future holiday, verifies the calendar
 * picker has selectable days in the holiday's month, navigates to
 * December of the holiday's year (max boundary), and checks that
 * January of the next year has all dates disabled.
 *
 * Frontend maxDate: moment(originalDate.format('YYYY')).add(1,'y').subtract(1,'d')
 * = Dec 31 of the holiday's year.
 */
test("TC-DO-014: Transfer modal max date boundary @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc014Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.username,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);
  const rescheduleDialog = new RescheduleDialog(page);

  try {
    // Step 1: Login as employee
    await login.run();

    // Step 2: Navigate to Days off tab
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Click edit on the target holiday row
    await dayOffPage.clickEditButton(data.holidayDateDisplay);
    await rescheduleDialog.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "dialog-opened");

    // Step 4: Verify the dialog's initial month has selectable working days.
    // The dialog opens on the holiday's month — working days should be enabled.
    const initialMonth = await rescheduleDialog.getCurrentMonthYear();
    const hasInitialAvailable = await rescheduleDialog.hasAvailableDays();
    expect(
      hasInitialAvailable,
      `Holiday month ${initialMonth.month + 1}/${initialMonth.year} should have selectable working days`,
    ).toBe(true);
    await verification.captureStep(testInfo, "initial-month-selectable");

    // Step 5: Navigate to December of the holiday's year (max boundary month).
    await rescheduleDialog.navigateToTargetMonth(
      data.maxBoundaryMonth,
      data.maxBoundaryYear,
    );
    await globalConfig.delay();

    // Step 6: Verify we reached December of max boundary year.
    const current = await rescheduleDialog.getCurrentMonthYear();
    expect(current.month, "Should be on December").toBe(11);
    expect(current.year, `Should be on ${data.maxBoundaryYear}`).toBe(
      data.maxBoundaryYear,
    );
    await verification.captureStep(testInfo, "dec-max-year-reached");

    // Step 7: Navigate to January of the next year — all dates should be disabled.
    await rescheduleDialog.navigateToTargetMonth(0, data.maxBoundaryYear + 1);
    await globalConfig.delay();
    const beyondMax = await rescheduleDialog.getCurrentMonthYear();
    if (beyondMax.year === data.maxBoundaryYear + 1) {
      const hasAvailableBeyond = await rescheduleDialog.hasAvailableDays();
      expect(
        hasAvailableBeyond,
        `Jan ${data.maxBoundaryYear + 1} should have no selectable days (beyond max boundary)`,
      ).toBe(false);
    }
    await verification.captureStep(testInfo, "beyond-max-disabled");

    // Step 8: Cancel
    await rescheduleDialog.clickCancel();
    await rescheduleDialog.waitForClose();
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
