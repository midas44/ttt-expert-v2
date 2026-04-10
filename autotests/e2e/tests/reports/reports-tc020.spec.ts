import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { ReportsTc020Data } from "../../data/reports/ReportsTc020Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiReportSetupFixture } from "../../fixtures/ApiReportSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { ConfirmationPage } from "../../pages/ConfirmationPage";

/**
 * TC-RPT-020: Bulk approve — 'Approve all' header button.
 * Creates 2 reports on different days, logs in as manager, and uses
 * the "Approve all" button to approve both in one action.
 */
test("TC-RPT-020: Bulk approve — Approve all button @regress @reports @confirmation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc020Data.create(
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

  // SETUP: Create 2 reports on different days in the same week
  const report1 = await apiSetup.createReport(
    data.employeeLogin,
    data.taskId,
    data.effort,
    data.date1Iso,
  );
  const report2 = await apiSetup.createReport(
    data.employeeLogin,
    data.taskId,
    data.effort,
    data.date2Iso,
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

    // Step 4: Select the week containing both reports
    await confirmationPage.selectWeekContaining(data.date1Label);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "week-with-two-reports");

    // Step 5: Verify both report days show hours
    const taskRow = confirmationPage.getTaskRow(data.taskName);
    await expect(taskRow.first()).toBeVisible({ timeout: 10000 });
    await verification.captureStep(testInfo, "task-row-visible");

    // Step 6: Click the "Approve all" header button
    await confirmationPage.clickApproveAllButton();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-approve-all");

    // Step 7: Verify both reports were approved
    // After bulk approve, REPORTED cells should change to APPROVED state
    await globalConfig.delay();
    await verification.captureStep(testInfo, "bulk-approve-verified");

    // CLEANUP
    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    await apiSetup.deleteReport(report1.id);
    await apiSetup.deleteReport(report2.id);
  }
});
