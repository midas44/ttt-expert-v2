import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc018Data } from "../../data/reports/ReportsTc018Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiReportSetupFixture } from "@ttt/fixtures/ApiReportSetupFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { ConfirmationPage } from "@ttt/pages/ConfirmationPage";

/**
 * TC-RPT-018: Reject hours with comment.
 * Creates a report via API, logs in as manager, rejects the report
 * with a comment via the rejection tooltip on the Confirmation page.
 */
test("TC-RPT-018: Reject hours with comment @regress @reports @confirmation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc018Data.create(
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

    // Step 3: Select the project
    await confirmationPage.selectFromDropdown(data.projectName);
    await globalConfig.delay();

    // Step 4: Select the week containing the report
    await confirmationPage.selectWeekContaining(data.dateLabel);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "week-with-report");

    // Step 5: Find the task row
    const taskRow = confirmationPage.getTaskRow(data.taskName);
    await expect(taskRow.first()).toBeVisible({ timeout: 10000 });

    // Step 6: Click the reject button on the task
    await confirmationPage.clickRejectOnTask(data.taskName);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "reject-tooltip-open");

    // Step 7: Fill the rejection comment and confirm
    await confirmationPage.fillRejectCommentAndConfirm(data.rejectComment);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-reject");

    // Step 8: Verify rejection took effect visually
    await globalConfig.delay();
    await verification.captureStep(testInfo, "rejection-verified");

    // CLEANUP
    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    await apiSetup.deleteReport(report.id);
  }
});
