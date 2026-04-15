import { test } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc003Data } from "../../data/reports/ReportsTc003Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { TaskReportingFixture } from "@ttt/fixtures/TaskReportingFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-003: Delete report by setting hours to 0.
 * Creates a 3h report as setup, then sets to 0 — verifies cell is empty (deleted).
 * TTT deletes reports when effort=0, rather than storing a zero-value record.
 */
test("TC-RPT-003: Delete report by setting hours to 0 @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc003Data.create(
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

  await verification.captureStep(testInfo, "my-tasks-loaded");

  // SETUP: Create a 3h report on the target cell
  const taskRow = await tasksPage.waitForTask(data.taskPattern);
  await reporting.fillReportValue(
    taskRow,
    data.dateLabel,
    data.setupHours,
    testInfo,
  );
  await reporting.verifyReportValue(
    data.taskPattern,
    data.dateLabel,
    data.setupHours,
    testInfo,
  );
  await verification.captureStep(testInfo, "setup-3h-created");

  // Step 4-5: Set the cell to 0 — this triggers report deletion
  await reporting.fillReportValue(taskRow, data.dateLabel, "0", testInfo, {
    verify: false,
  });

  // Step 6: Verify the cell is now empty (report deleted, not stored as 0)
  await reporting.verifyReportEmpty(
    data.taskPattern,
    data.dateLabel,
    testInfo,
  );
  await verification.captureStep(testInfo, "report-deleted-cell-empty");

  await logout.runViaDirectUrl();
  await page.close();
});
