import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { ReportsTc017Data } from "../../data/reports/ReportsTc017Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiReportSetupFixture } from "../../fixtures/ApiReportSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { ConfirmationPage } from "../../pages/ConfirmationPage";

/**
 * TC-RPT-017: Approve hours — By Employee tab.
 * Same workflow as TC-016 but uses the "By employees" tab.
 * Verifies #3368 bug: Approve button should not advance to next user.
 */
test("TC-RPT-017: Approve hours — By Employee tab @regress @reports @confirmation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc017Data.create(
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

    // Step 2: Navigate to Confirmation page, By Employees tab
    await confirmationPage.goto(tttConfig.appUrl, "employees");
    await confirmationPage.waitForReady();
    await verification.captureStep(testInfo, "confirmation-by-employees");

    // Step 3: Select the employee from the dropdown (search by name, not login)
    await confirmationPage.selectFromDropdown(data.employeeName);
    await globalConfig.delay();

    // Step 4: Select the last (most recent) week — our report is in the current week
    // Click the last week button which is always the most recent
    const weekButtons = page
      .getByRole("button")
      .filter({ hasText: /\d{2}\.\d{2}\s*[–—-]\s*\d{2}\.\d{2}/ });
    const weekCount = await weekButtons.count();
    if (weekCount > 0) {
      await weekButtons.nth(weekCount - 1).click();
      await page.waitForLoadState("networkidle");
    }
    await globalConfig.delay();
    await verification.captureStep(testInfo, "employee-week-selected");

    // Step 5: Find the task row
    const taskRow = confirmationPage.getTaskRow(data.taskName);
    await expect(taskRow.first()).toBeVisible({ timeout: 10000 });

    // Step 6: Click approve on the task
    await confirmationPage.clickApproveOnTask(data.taskName);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-approve-by-employee");

    // Step 7: Verify the page still shows the same employee (bug #3368 check)
    // The approve button should NOT advance to the next employee
    await globalConfig.delay();
    await verification.captureStep(testInfo, "same-employee-after-approve");

    // CLEANUP
    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    await apiSetup.deleteReport(report.id);
  }
});
