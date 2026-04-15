import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T3404Tc012Data } from "../../data/t3404/T3404Tc012Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-T3404-012: Open month (March) — working days are enabled.
 * In March 2026 with approve period starting March 1:
 * - Weekdays (Mon-Fri) that are not holidays should be enabled
 * - Weekends (Sat, Sun) should be disabled
 * - March 1 = Sunday (disabled), March 7 = Saturday (disabled)
 */
test("TC-T3404-012: Open month March working days enabled @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc012Data.create(
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

  // Step 4: Ensure we're on March (the day-off month)
  await rescheduleDialog.navigateToTargetMonth(
    data.calendarMonth,
    data.calendarYear,
  );
  await globalConfig.delay();
  await verification.captureStep(testInfo, "march-calendar-open");

  // Step 5: Get enabled/disabled day states
  const { enabled, disabled } = await rescheduleDialog.getDayStates();

  // Verify working days are present (March has 22 weekdays; some may be
  // disabled by holidays or existing day-offs, but most should be enabled)
  expect(enabled.length).toBeGreaterThan(5);

  // Verify weekends are disabled: March 1 (Sun), 7 (Sat), 8 (Sun)
  expect(disabled).toContain(1);  // Sunday
  expect(disabled).toContain(7);  // Saturday
  expect(disabled).toContain(8);  // Sunday

  // Verify mix: not ALL days are disabled (positive test)
  expect(enabled.length).toBeGreaterThan(disabled.length);

  await verification.captureStep(testInfo, "march-day-states-verified");

  // Cleanup
  await rescheduleDialog.clickCancel();
  await rescheduleDialog.waitForClose();
  await logout.runViaDirectUrl();
  await page.close();
});
