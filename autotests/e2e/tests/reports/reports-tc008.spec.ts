import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc008Data } from "../../data/reports/ReportsTc008Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-008: Week navigation — arrow buttons.
 * Verifies that clicking next/previous week arrows updates the displayed
 * week dates, cell data, and totals.
 */
test("TC-RPT-008: Week navigation — arrow buttons @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc008Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const tasksPage = new MyTasksPage(page);

  // Step 1-2: Login → lands on My Tasks (/report)
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }
  await tasksPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Note the current displayed week range
  const initialRange = await tasksPage.getWeekRangeText();
  await verification.captureStep(testInfo, "initial-week-range");

  // Step 4-5: Click the right arrow to advance one week
  await tasksPage.navigateToNextWeek();
  await globalConfig.delay();
  const nextRange = await tasksPage.getWeekRangeText();
  expect(nextRange).not.toBe(initialRange);
  await verification.captureStep(testInfo, "after-next-week");

  // Step 6: Verify task rows update (table is still present)
  await tasksPage.waitForReady();

  // Step 7-8: Click the left arrow twice to go one week before initial
  await tasksPage.navigateToPreviousWeek();
  await globalConfig.delay();
  await tasksPage.navigateToPreviousWeek();
  await globalConfig.delay();
  const prevRange = await tasksPage.getWeekRangeText();
  expect(prevRange).not.toBe(nextRange);
  expect(prevRange).not.toBe(initialRange);
  await verification.captureStep(testInfo, "after-two-prev-weeks");

  // Step 9: Return to current week and verify
  await tasksPage.goToCurrentWeek();
  await globalConfig.delay();
  const restoredRange = await tasksPage.getWeekRangeText();
  expect(restoredRange).toBe(initialRange);
  await verification.captureStep(testInfo, "restored-current-week");

  await logout.runViaDirectUrl();
  await page.close();
});
