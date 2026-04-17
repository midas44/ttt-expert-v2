import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc016Data } from "../../data/reports/ReportsTc016Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiReportSetupFixture } from "@ttt/fixtures/ApiReportSetupFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { ConfirmationPage } from "@ttt/pages/ConfirmationPage";

/**
 * TC-RPT-016: Approve hours — By Projects tab, single task.
 * Creates a report via API, logs in as manager, navigates to Confirmation
 * page "By projects" tab, finds the task, and approves it.
 */
test("TC-RPT-016: Approve hours — By Projects tab @regress @reports @confirmation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc016Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const apiSetup = new ApiReportSetupFixture(request, tttConfig);
  const login = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const confirmationPage = new ConfirmationPage(page);

  // SETUP: Create a report for the employee via API
  const report = await apiSetup.createReport(
    data.employeeLogin,
    data.taskId,
    data.effort,
    data.dateIso,
  );

  try {
    // Step 1: Login as the manager
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2: Navigate to Confirmation page, By Projects tab
    await confirmationPage.goto(tttConfig.appUrl, "projects");
    await confirmationPage.waitForReady();
    await verification.captureStep(testInfo, "confirmation-page-loaded");

    // Step 3: Select the project from the dropdown
    await confirmationPage.selectFromDropdown(data.projectName);
    await globalConfig.delay();

    // Step 4: Select the week containing the report date
    await confirmationPage.selectWeekContaining(data.dateLabel);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "week-selected");

    // Step 5: Find the task row with reported hours
    const taskRow = confirmationPage.getTaskRow(data.taskName);
    await expect(taskRow.first()).toBeVisible({ timeout: 10000 });

    // Step 6: Click approve on the task
    await confirmationPage.clickApproveOnTask(data.taskName);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-approve");

    // Step 7: Verify the approval took effect — task row should no longer
    // have green REPORTED cells (they become white = APPROVED)
    await globalConfig.delay();
    await verification.captureStep(testInfo, "approval-verified");

    // CLEANUP
    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    await apiSetup.deleteReport(report.id);
  }
});
