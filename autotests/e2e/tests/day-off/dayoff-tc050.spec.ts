import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc050Data } from "../../data/day-off/DayoffTc050Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-DO-050: Transfer to already-used personalDate blocked in UI.
 *
 * SETUP creates a transfer occupying personalDate X. The test opens
 * the reschedule dialog for a different holiday and verifies that
 * date X is disabled (cannot be selected) in the calendar picker.
 * This validates the @EmployeeDayOffPersonalDateExists UI enforcement.
 */
test("TC-DO-050: Transfer to already-used personalDate blocked in UI @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc050Data.create(
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

    // Step 3: Click edit on holiday2 (not the one with existing transfer)
    await dayOffPage.clickEditButton(data.holiday2Display);
    await rescheduleDialog.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "dialog-opened");

    // Step 4: Navigate to the personalDate's month
    const { day, month, year } = data.personalDateParts;
    await rescheduleDialog.navigateToTargetMonth(month, year);
    await globalConfig.delay();

    // Step 5: Verify the personalDate is disabled (already used)
    const isDisabled = await rescheduleDialog.isDayDisabled(day);
    expect(
      isDisabled,
      `Day ${day} (personalDate ${data.personalDate}) should be disabled — already used by existing transfer`,
    ).toBe(true);
    await verification.captureStep(testInfo, "used-personal-date-disabled");

    // Step 6: Cancel
    await rescheduleDialog.clickCancel();
    await rescheduleDialog.waitForClose();
  } finally {
    await DayoffTc050Data.cleanup(data.requestId, tttConfig);
    await logout.runViaDirectUrl();
    await page.close();
  }
});
