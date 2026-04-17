import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T3404Tc010Data } from "../../data/t3404/T3404Tc010Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-T3404-014: Boundary — Feb 28 (day before approve period) is disabled.
 * Approve period starts March 1. Feb 28 is a Saturday in 2026, so it is
 * double-disabled: both before approve period AND a weekend.
 * Reuses TC-010 data (employee with editable day-off in open period).
 */
test("TC-T3404-014: Feb 28 disabled in datepicker @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc010Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);
  const rescheduleDialog = new RescheduleDialog(page);

  // Step 1-2: Login and navigate to Days off tab
  await login.run();
  await dayOffPage.goto(tttConfig.appUrl);
  await dayOffPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Open reschedule dialog
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();

  // Step 4: Navigate datepicker to February
  await rescheduleDialog.navigateToTargetMonth(1, data.calendarYear); // Feb = 1
  await globalConfig.delay();

  const monthYear = await rescheduleDialog.getCurrentMonthYear();
  expect(monthYear.month).toBe(1); // February
  await verification.captureStep(testInfo, "on-february");

  // Step 5: Verify Feb 28 is disabled
  const feb28Disabled = await rescheduleDialog.isDayDisabled(28);
  expect(feb28Disabled).toBe(true);
  await verification.captureStep(testInfo, "feb-28-disabled");

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
