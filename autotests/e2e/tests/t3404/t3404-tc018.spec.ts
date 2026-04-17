import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T3404Tc016Data } from "../../data/t3404/T3404Tc016Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-T3404-018: February dates NOT selectable (closed period).
 * Navigating backward from a March day-off to February — all dates should be
 * disabled because February is before the approve period start.
 */
test("TC-T3404-018: Feb dates NOT selectable in datepicker @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc016Data.create(
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

  // Step 3: Open reschedule dialog for a March day-off
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();

  // Step 4: Navigate datepicker backward to February
  await rescheduleDialog.navigateToTargetMonth(1, data.calendarYear); // Feb = 1
  await globalConfig.delay();

  const monthYear = await rescheduleDialog.getCurrentMonthYear();
  expect(monthYear.month).toBe(1); // February
  await verification.captureStep(testInfo, "on-february");

  // Step 5: Verify ALL February dates are disabled
  const allDisabled = await rescheduleDialog.areAllCurrentMonthDaysDisabled();
  expect(allDisabled).toBe(true);
  await verification.captureStep(testInfo, "february-all-disabled");

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
