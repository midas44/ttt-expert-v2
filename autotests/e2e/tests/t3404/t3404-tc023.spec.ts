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
 * TC-T3404-023: Max date unchanged — Dec 31 of the original date's year.
 * Regression test: maxDate formula = moment(originalDate.format("YYYY")).add(1,"y").subtract(1,"d")
 * which gives Dec 31 of the same year. January of next year should NOT be selectable.
 */
test("TC-T3404-023: Max date Dec 31 unchanged @regress @t3404", async ({
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

  // Step 4: Navigate datepicker forward to December of the same year
  await rescheduleDialog.navigateToTargetMonth(11, data.calendarYear); // Dec = 11
  await globalConfig.delay();

  const decMonthYear = await rescheduleDialog.getCurrentMonthYear();
  expect(decMonthYear.month).toBe(11); // December
  expect(decMonthYear.year).toBe(data.calendarYear);
  await verification.captureStep(testInfo, "on-december");

  // Step 5: Verify December has at least some enabled working days
  const decStates = await rescheduleDialog.getDayStates();
  expect(decStates.enabled.length).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "december-has-enabled-days");

  // Step 6: Try to navigate past December to January of next year
  await rescheduleDialog.clickNextMonth();
  await globalConfig.delay();

  const afterNav = await rescheduleDialog.getCurrentMonthYear();

  if (afterNav.month === 0 && afterNav.year === data.calendarYear + 1) {
    // Reached January next year — all dates should be disabled (past maxDate)
    const allDisabled =
      await rescheduleDialog.areAllCurrentMonthDaysDisabled();
    expect(allDisabled).toBe(true);
    await verification.captureStep(testInfo, "january-all-disabled");
  } else {
    // Navigation blocked at December — maxDate boundary prevents going further
    expect(afterNav.month).toBe(11);
    expect(afterNav.year).toBe(data.calendarYear);
    await verification.captureStep(testInfo, "december-is-max");
  }

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
