import { test } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { ReportsTc002Data } from "../../data/reports/ReportsTc002Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { TaskReportingFixture } from "../../fixtures/TaskReportingFixture";
import { MainPage, MyTasksPage } from "../../pages/MainPage";

/**
 * TC-RPT-002: Edit existing report — change hours.
 * Creates a 2h report as setup, then edits to 6h.
 * Verifies the cell shows the updated value.
 */
test("TC-RPT-002: Edit existing report — change hours @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc002Data.create(
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

  // SETUP: Create a 2h report on the target cell
  const taskRow = await tasksPage.waitForTask(data.taskPattern);
  await reporting.fillReportValue(
    taskRow,
    data.dateLabel,
    data.setupHours,
    testInfo,
  );
  await verification.captureStep(testInfo, "setup-2h-created");

  // Step 4-7: Edit the cell from 2h to 6h
  await reporting.fillReportValue(
    taskRow,
    data.dateLabel,
    data.editHours,
    testInfo,
  );

  // Step 8: Verify the cell shows 6
  await reporting.verifyReportValue(
    data.taskPattern,
    data.dateLabel,
    data.editHours,
    testInfo,
  );
  await verification.captureStep(testInfo, "report-edited-6h");

  // CLEANUP: Delete the report by entering 0
  await reporting.fillReportValue(taskRow, data.dateLabel, "0", testInfo, {
    verify: false,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
