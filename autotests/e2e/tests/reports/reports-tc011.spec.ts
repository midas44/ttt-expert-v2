import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { ReportsTc011Data } from "../../data/reports/ReportsTc011Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage, MyTasksPage } from "../../pages/MainPage";

/**
 * TC-RPT-011: TAB key stacking bug (regression #3398).
 * Verifies that pressing TAB in the task grid does not create
 * stacked/duplicate input fields. Each cell should have at most one input.
 */
test("TC-RPT-011: TAB key stacking bug — regression #3398 @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc011Data.create(
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
  await verification.captureStep(testInfo, "my-tasks-loaded");

  // Step 3-4: Click an empty cell to open the inline editor
  const taskRow = await tasksPage.waitForTask(data.taskPattern);
  const cell = await tasksPage.dayCell(taskRow, data.dateLabel);
  const editor = await tasksPage.openInlineEditor(cell);
  await verification.captureStep(testInfo, "single-input-opened");

  // Step 5-7: Press TAB key 4 times rapidly without entering a value
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    // Small delay to let the UI respond, but fast enough to trigger stacking
    await page.waitForTimeout(200);
  }
  await verification.captureStep(testInfo, "after-4-tabs");

  // Step 8: Verify NO duplicate/stacked input fields
  // Count all visible input/textarea elements in the table area
  const tableInputs = page.locator(
    "table input:visible, table textarea:visible",
  );
  const inputCount = await tableInputs.count();
  // At most 1 input should be visible (the active cell editor)
  expect(inputCount).toBeLessThanOrEqual(1);

  // Also check for floating editor duplicates
  const floatingEditors = page.locator(
    "[class*='timesheet-reporting__input'] input:visible, [class*='timesheet-reporting__input'] textarea:visible",
  );
  const floatingCount = await floatingEditors.count();
  expect(floatingCount).toBeLessThanOrEqual(1);

  await verification.captureStep(testInfo, "no-stacked-inputs-confirmed");

  // Step 9: Verify the grid remains visually clean
  // Press Escape to close any open editor
  await page.keyboard.press("Escape");
  await globalConfig.delay();
  await verification.captureStep(testInfo, "grid-clean-after-escape");

  await logout.runViaDirectUrl();
  await page.close();
});
