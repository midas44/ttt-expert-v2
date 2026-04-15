import { test } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc001Data } from "../../data/reports/ReportsTc001Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { TaskReportingFixture } from "@ttt/fixtures/TaskReportingFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-001: Create a time report — happy path.
 * Verifies that an employee can enter hours for a task in the weekly grid.
 * Expected: cell shows entered value, totals update.
 */
test("TC-RPT-001: Create a time report — happy path @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc001Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const tasksPage = new MyTasksPage(page);
  const reporting = new TaskReportingFixture(page, globalConfig, verification);

  // Step 1-2: Login → lands on My Tasks (/report)
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }
  await tasksPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Verify weekly grid is displayed
  await verification.captureStep(testInfo, "my-tasks-loaded");

  // Step 4-7: Find task row and enter 4 hours
  const taskRow = await tasksPage.waitForTask(data.taskPattern);
  await reporting.fillReportValue(taskRow, data.dateLabel, data.hours, testInfo);

  // Step 8: Verify cell displays the entered value
  await reporting.verifyReportValue(
    data.taskPattern,
    data.dateLabel,
    data.hours,
    testInfo,
  );
  await verification.captureStep(testInfo, "report-created-4h");

  // CLEANUP: Delete the report by entering 0 (TTT deletes reports with effort=0)
  await reporting.fillReportValue(taskRow, data.dateLabel, "0", testInfo, {
    verify: false,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
