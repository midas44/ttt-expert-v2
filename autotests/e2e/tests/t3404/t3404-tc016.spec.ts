import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T3404Tc016Data } from "../../data/t3404/T3404Tc016Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";

/**
 * TC-T3404-016: Select earlier date within same month (core new behavior).
 * Ticket #3404 relaxes the datepicker minDate for past day-offs:
 * instead of being locked to the original date, it now allows selection
 * from the approve period start date onward.
 */
test("TC-T3404-016: Select earlier date within same month @regress @t3404", async ({
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

  // Step 3: Click edit icon on the past day-off
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "reschedule-dialog-opened");

  // Step 4: Navigate to the same month and verify earlier dates are enabled
  await rescheduleDialog.navigateToTargetMonth(
    data.calendarMonth,
    data.calendarYear,
  );

  // Verify an earlier date (first working day of month) is NOT disabled
  const earlierDay = data.firstWorkingDayOfMonth;
  const isDisabled = await rescheduleDialog.isDayDisabled(earlierDay);
  expect(isDisabled).toBe(false);
  await verification.captureStep(testInfo, "earlier-date-enabled");

  // Step 5: Select the earlier date
  await rescheduleDialog.selectDate(
    earlierDay,
    data.calendarMonth,
    data.calendarYear,
  );
  await globalConfig.delay();

  // Step 6: Verify OK button is enabled after selecting the earlier date
  const okEnabled = await rescheduleDialog.isOkEnabled();
  expect(okEnabled).toBe(true);
  await verification.captureStep(testInfo, "ok-button-enabled");

  // Don't submit — cancel to avoid data mutation
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();

  // Cleanup
  await logout.runViaDirectUrl();
  await page.close();
});
