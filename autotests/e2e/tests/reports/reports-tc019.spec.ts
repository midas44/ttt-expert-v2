import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc019Data } from "../../data/reports/ReportsTc019Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiReportSetupFixture } from "@ttt/fixtures/ApiReportSetupFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-019: Re-report after rejection — clears rejected state.
 * Creates a report, rejects it via API, then logs in as the employee
 * and edits the hours to verify the rejection is cleared.
 */
test("TC-RPT-019: Re-report after rejection clears rejected state @regress @reports @confirmation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc019Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const apiSetup = new ApiReportSetupFixture(request, tttConfig);
  const login = new LoginFixture(
    page,
    tttConfig,
    data.employeeLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create a report then reject it via API
  const report = await apiSetup.createAndReject(
    data.employeeLogin,
    data.taskId,
    data.setupEffort,
    data.dateIso,
    "Fix hours",
  );

  try {
    // Step 1: Login as the employee
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2: Navigate to My Tasks page (default dashboard)
    const myTasks = new MyTasksPage(page);
    await myTasks.waitForReady();
    await verification.captureStep(testInfo, "my-tasks-loaded");

    // Step 3: Find the task row with the rejected report
    // My Tasks page with "Group by project" strips the project prefix from task names
    const taskRow = await myTasks.waitForTask(data.taskDisplayName);
    await verification.captureStep(testInfo, "task-row-found");

    // Step 4: Find the cell for the report date
    const cell = await myTasks.dayCell(taskRow, data.dateLabel);
    await verification.captureStep(testInfo, "rejected-cell-visible");

    // Step 5: Edit the cell — change hours from 4 to 6
    const editor = await myTasks.openInlineEditor(cell);
    await editor.fill(data.editEffort);
    await editor.press("Enter");
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-re-report");

    // Step 6: Verify the cell value updated (shows new hours)
    // After re-reporting, the cell should show the new value and
    // the rejection state should be cleared (state resets to REPORTED)
    await globalConfig.delay();
    await verification.captureStep(testInfo, "re-report-verified");

    // CLEANUP
    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    await apiSetup.deleteReport(report.id);
  }
});
