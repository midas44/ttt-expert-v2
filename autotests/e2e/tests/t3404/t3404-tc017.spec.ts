import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T3404Tc017Data } from "../../data/t3404/T3404Tc017Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-T3404-017: First working day of month is selectable as transfer target.
 * Opens reschedule dialog for a mid-month past day-off and verifies that
 * March 2 (first working day — March 1 is Sunday) can be selected and
 * accepted as the transfer target.
 */
test("TC-T3404-017: First working day selectable as transfer target @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc017Data.create(
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

  // Step 3: Click edit on the past day-off
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "reschedule-dialog-opened");

  // Step 4: Navigate to the month and verify March 2 is not disabled
  await rescheduleDialog.navigateToTargetMonth(
    data.calendarMonth,
    data.calendarYear,
  );

  const firstWorkingDay = data.firstWorkingDayOfMonth;
  const isDisabled = await rescheduleDialog.isDayDisabled(firstWorkingDay);
  expect(isDisabled).toBe(false);

  // Step 5: Click March 2 to select it as transfer target
  await rescheduleDialog.selectDate(
    firstWorkingDay,
    data.calendarMonth,
    data.calendarYear,
  );
  await globalConfig.delay();

  // Step 6: Verify OK button is enabled (date accepted as valid target)
  const okEnabled = await rescheduleDialog.isOkEnabled();
  expect(okEnabled).toBe(true);
  await verification.captureStep(testInfo, "first-working-day-selected");

  // Don't submit — cancel to avoid data mutation
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();

  // Cleanup
  await logout.runViaDirectUrl();
  await page.close();
});
