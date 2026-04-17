import { test } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc010Data } from "../../data/reports/ReportsTc010Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { TaskReportingFixture } from "@ttt/fixtures/TaskReportingFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-010: Report with decimal hours (e.g., 1.5).
 * Verifies that decimal values are accepted, stored as 90 minutes,
 * and displayed correctly in the grid.
 */
test("TC-RPT-010: Report with decimal hours (1.5) @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc010Data.create(
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

  // Step 3-4: Enter 1.5 hours in the target cell
  const taskRow = await tasksPage.waitForTask(data.taskPattern);
  await reporting.fillReportValue(
    taskRow,
    data.dateLabel,
    data.hours,
    testInfo,
  );

  // Step 5: Verify cell displays "1.5"
  await reporting.verifyReportValue(
    data.taskPattern,
    data.dateLabel,
    data.hours,
    testInfo,
  );
  await verification.captureStep(testInfo, "decimal-1.5h-created");

  // CLEANUP: Delete the report by entering 0
  await reporting.fillReportValue(taskRow, data.dateLabel, "0", testInfo, {
    verify: false,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
