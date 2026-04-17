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
 * TC-T3404-013: Future month (April) — working days enabled in datepicker.
 * April is in the open approve period, so working days should be selectable.
 */
test("TC-T3404-013: Future month Apr enabled @regress @t3404", async ({
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

  // Step 3: Click edit on an editable day-off to open reschedule dialog
  await dayOffPage.clickEditButton(data.dateDisplay);
  await rescheduleDialog.waitForOpen();
  await globalConfig.delay();

  // Step 4: Navigate datepicker forward to April
  await rescheduleDialog.navigateToTargetMonth(3, data.calendarYear); // April = 3
  await globalConfig.delay();

  const monthYear = await rescheduleDialog.getCurrentMonthYear();
  expect(monthYear.month).toBe(3); // April
  await verification.captureStep(testInfo, "on-april");

  // Step 5: Verify working days are enabled
  const { enabled, disabled } = await rescheduleDialog.getDayStates();
  expect(enabled.length).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "april-working-days-enabled");

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
