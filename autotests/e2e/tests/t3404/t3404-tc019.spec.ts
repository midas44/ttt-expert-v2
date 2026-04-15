import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T3404Tc019Data } from "../../data/t3404/T3404Tc019Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-T3404-019: Future holiday — minDate still uses original date (ST-4).
 * For a future mid-month holiday (e.g., May 9), earlier working days in the
 * same month (May 2-8) should be DISABLED because the code uses originalDate
 * as minDate for future day-offs, not startOf(month).
 * This tests the ST-4 incomplete implementation noted in the ticket analysis.
 */
test("TC-T3404-019: Future holiday minDate uses original date @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc019Data.create(
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

  // Step 3: Open reschedule dialog for the future mid-month day-off
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();

  // Ensure we're on the correct month
  await rescheduleDialog.navigateToTargetMonth(
    data.calendarMonth,
    data.calendarYear,
  );
  await globalConfig.delay();
  await verification.captureStep(testInfo, "dialog-on-target-month");

  // Step 4: Verify an earlier working day in the same month is DISABLED
  // This confirms minDate = originalDate (not startOf(month))
  const earlierDay = data.earlierDayInMonth;
  const isDisabled = await rescheduleDialog.isDayDisabled(earlierDay);
  expect(isDisabled).toBe(true);
  await verification.captureStep(testInfo, `day-${earlierDay}-disabled`);

  // Step 5: Verify the original date day itself is enabled (minDate boundary)
  // Note: the original date is a holiday (duration=0) so it may be disabled
  // as "already a holiday". Instead verify that a day AFTER is enabled.
  const dayStates = await rescheduleDialog.getDayStates();
  const enabledAfterOriginal = dayStates.enabled.filter(
    (d) => d > data.dayoffDay,
  );
  expect(enabledAfterOriginal.length).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "days-after-original-enabled");

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
