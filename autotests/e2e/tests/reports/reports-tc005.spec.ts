import { test } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc005Data } from "../../data/reports/ReportsTc005Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { TaskReportingFixture } from "@ttt/fixtures/TaskReportingFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-005: Add new task on My Tasks page.
 * Searches for an available task via the "Add a task" button,
 * verifies the task appears as a new row in the weekly grid.
 */
test("TC-RPT-005: Add new task on My Tasks page @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc005Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const reporting = new TaskReportingFixture(page, globalConfig, verification);
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

  // Step 3-5: Click "Add a task", search, and select the first matching task
  const taskRow = await reporting.addTaskFromSearch(
    data.searchTerm,
    data.taskPattern,
    testInfo,
  );

  // Step 6: Verify the task row is visible in the grid
  await verification.captureStep(testInfo, "task-added-to-grid");

  // Step 7: Verify the row has empty cells (no reports yet)
  await reporting.verifySearchEmpty(testInfo);
  await reporting.clearSearch();

  await logout.runViaDirectUrl();
  await page.close();
});
