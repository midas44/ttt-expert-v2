import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc015Data } from "../../data/day-off/DayoffTc015Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";

/**
 * TC-DO-015: Transfer calendar disables existing day-off dates.
 *
 * SETUP creates a transfer for holiday1 → personalDate.
 * Test opens the reschedule dialog for holiday2 and verifies
 * that personalDate is disabled (greyed out) in the calendar picker.
 */
test("TC-DO-015: Transfer calendar disables existing day-off dates @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc015Data.create(
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

    // Step 3: Click edit on holiday2 (different from the one with the setup transfer)
    await dayOffPage.clickEditButton(data.holiday2Display);
    await rescheduleDialog.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "dialog-opened-for-holiday2");

    // Step 4: Navigate to the month containing the occupied personalDate
    const { day, month, year } = data.personalDateParts;
    await rescheduleDialog.navigateToTargetMonth(month, year);
    await globalConfig.delay();

    // Step 5: Verify the personalDate day is disabled in the calendar
    const isDisabled = await rescheduleDialog.isDayDisabled(day);
    expect(
      isDisabled,
      `Day ${day} (personalDate ${data.personalDate}) should be disabled — already used by another transfer`,
    ).toBe(true);
    await verification.captureStep(testInfo, "personal-date-disabled");

    // Step 6: Cancel the dialog
    await rescheduleDialog.clickCancel();
    await rescheduleDialog.waitForClose();
  } finally {
    await DayoffTc015Data.cleanup(data.requestId, tttConfig);
    await logout.runViaDirectUrl();
    await page.close();
  }
});
