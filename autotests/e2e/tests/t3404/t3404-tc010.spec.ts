import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T3404Tc010Data } from "../../data/t3404/T3404Tc010Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";

/**
 * TC-T3404-010: Closed month (January) — all dates disabled in datepicker.
 * minDate = approvePeriod - 1 day = Feb 28. January is entirely before
 * minDate, so either navigation to January is blocked or all dates disabled.
 */
test("TC-T3404-010: Closed month January all dates disabled @regress @t3404", async ({
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

  // Step 3: Click edit on an editable day-off
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();

  // Step 4: Navigate backward to February first
  await rescheduleDialog.navigateToTargetMonth(1, data.calendarYear); // February
  await globalConfig.delay();

  const beforeNav = await rescheduleDialog.getCurrentMonthYear();
  expect(beforeNav.month).toBe(1); // Confirm we're on February
  await verification.captureStep(testInfo, "on-february");

  // Step 5: Try to navigate backward one more month (to January)
  await rescheduleDialog.clickPrevMonth();
  await globalConfig.delay();

  const afterNav = await rescheduleDialog.getCurrentMonthYear();

  if (afterNav.month === 0 && afterNav.year === data.calendarYear) {
    // Reached January — verify all dates are disabled
    const allDisabled = await rescheduleDialog.areAllCurrentMonthDaysDisabled();
    expect(allDisabled).toBe(true);
    await verification.captureStep(testInfo, "january-all-disabled");
  } else {
    // Navigation blocked — still on February. January is not reachable.
    expect(afterNav.month).toBe(1);
    await verification.captureStep(testInfo, "january-not-navigable");
  }

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
