import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc016Data } from "../../data/day-off/DayoffTc016Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";

/**
 * TC-DO-016: Working weekend dates selectable in transfer calendar.
 *
 * Opens the reschedule dialog and navigates to a month containing a
 * working weekend (Sat/Sun marked as working in the production calendar).
 * Verifies the working weekend is selectable while regular weekends
 * remain disabled.
 */
test("TC-DO-016: Working weekend dates selectable in transfer calendar @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc016Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
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

    // Step 3: Click edit on the future holiday
    await dayOffPage.clickEditButton(data.holidayDateDisplay);
    await rescheduleDialog.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "dialog-opened");

    // Step 4: Navigate to the month containing the working weekend
    const { day: wwDay, month, year } = data.workingWeekendParts;
    await rescheduleDialog.navigateToTargetMonth(month, year);
    await globalConfig.delay();

    // Step 5: Verify the working weekend day is NOT disabled (selectable)
    const wwDisabled = await rescheduleDialog.isDayDisabled(wwDay);
    expect(
      wwDisabled,
      `Working weekend day ${wwDay} (${data.workingWeekendDate}) should be selectable`,
    ).toBe(false);
    await verification.captureStep(testInfo, "working-weekend-enabled");

    // Step 6: Verify a regular weekend in the same month IS disabled
    const regularDay = data.regularWeekendDay;
    if (regularDay > 0) {
      const regularDisabled = await rescheduleDialog.isDayDisabled(regularDay);
      expect(
        regularDisabled,
        `Regular weekend day ${regularDay} should be disabled`,
      ).toBe(true);
      await verification.captureStep(testInfo, "regular-weekend-disabled");
    }

    // Step 7: Cancel the dialog
    await rescheduleDialog.clickCancel();
    await rescheduleDialog.waitForClose();
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
