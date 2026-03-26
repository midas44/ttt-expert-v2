import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T3404Tc015Data } from "../../data/t3404/T3404Tc015Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";

/**
 * TC-T3404-015: Boundary — March 2 (first working day of open period) is enabled.
 * March 1 is Sunday (disabled). March 2 is Monday — the practical minimum
 * selectable date in the open approve period.
 */
test("TC-T3404-015: March 2 first working day is enabled @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc015Data.create(
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

  // Step 4: Ensure we're on March
  await rescheduleDialog.navigateToTargetMonth(
    data.calendarMonth,
    data.calendarYear,
  );

  // Step 5: Verify March 1 (Sunday) is disabled
  const mar1Disabled = await rescheduleDialog.isDayDisabled(1);
  expect(mar1Disabled).toBe(true);

  // Step 6: Verify March 2 (Monday — first working day) is enabled
  const mar2Disabled = await rescheduleDialog.isDayDisabled(2);
  expect(mar2Disabled).toBe(false);
  await verification.captureStep(testInfo, "march-2-enabled");

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
