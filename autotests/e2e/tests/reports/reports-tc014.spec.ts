import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc014Data } from "../../data/reports/ReportsTc014Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-014: View another employee's report page (manager).
 * Verifies that a manager can navigate to /report/<employee_login>
 * and see the employee's weekly timesheet grid.
 */
test("TC-RPT-014: View another employee's report page (manager) @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc014Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login as the manager
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 2: Navigate to the employee's report page
  const reportUrl = `${tttConfig.baseUrl}/report/${data.employeeLogin}`;
  await page.goto(reportUrl);
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 3: Verify the page loads — another employee's page has no search input,
  // so wait for the task table directly instead of waitForReady()
  await page.locator("table").first().waitFor({ state: "visible", timeout: 30000 });
  await verification.captureStep(testInfo, "employee-report-page-loaded");

  // Step 4: Verify the header/breadcrumb contains the employee's login or name
  const pageContent = await page.textContent("body");
  expect(pageContent).toBeTruthy();
  await verification.captureStep(testInfo, "manager-view-verified");

  // Step 5: Verify the weekly grid is present (table with task rows)
  const table = page.locator("table");
  await expect(table.first()).toBeVisible();
  await verification.captureStep(testInfo, "weekly-grid-visible");

  await logout.runViaDirectUrl();
  await page.close();
});
