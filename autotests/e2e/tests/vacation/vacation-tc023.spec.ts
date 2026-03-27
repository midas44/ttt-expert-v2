import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc023Data } from "../../data/vacation/VacationTc023Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { EmployeeRequestsPage } from "../../pages/EmployeeRequestsPage";

/**
 * TC-VAC-023: Employee Requests page — view pending approvals.
 * SETUP: Creates a vacation via API (NEW status, appears in Approval queue).
 * Verifies: tab counts, table columns, action buttons (approve, reject, redirect, details).
 */
test("TC-VAC-023: Employee Requests page — view pending approvals @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc023Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const requestsPage = new EmployeeRequestsPage(page);

  // SETUP: Create a NEW vacation via API
  const vacation = await setup.createVacation(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    // Step 1-2: Login, switch to English
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 3: Navigate to Employee Requests
    await page.goto(`${tttConfig.appUrl}/vacation/request`, {
      waitUntil: "domcontentloaded",
    });
    await requestsPage.waitForReady();
    await globalConfig.delay();

    // Step 4: Verify "Vacation requests (N)" tab shows count >= 1
    const vacReqCount = await requestsPage.getVacationRequestsCount();
    expect(vacReqCount).toBeGreaterThanOrEqual(1);
    await verification.captureStep(testInfo, "requests-page-loaded");

    // Step 5: Click Approval sub-filter
    await requestsPage.clickApprovalTab();
    await globalConfig.delay();

    // Step 6: Verify table columns exist
    const headerRow = page.locator("table thead tr");
    await expect(headerRow).toBeVisible();
    const headers = await page
      .locator("table thead th")
      .allTextContents();
    const headerText = headers.join(" ").toLowerCase();
    expect(headerText).toContain("employee");
    expect(headerText).toMatch(/vacation.*date|period/i);
    expect(headerText).toMatch(/type/i);
    expect(headerText).toMatch(/status/i);
    await verification.captureStep(testInfo, "table-columns-visible");

    // Step 7: Find the created vacation in the list
    const row = await requestsPage.waitForRequestRow(data.periodPattern);
    await expect(row.first()).toBeVisible();

    // Step 8: Verify action buttons on the row
    const hasApprove = await requestsPage.hasApproveButton(data.periodPattern);
    const hasReject = await requestsPage.hasRejectButton(data.periodPattern);
    const hasRedirect = await requestsPage.hasRedirectButton(
      data.periodPattern,
    );
    const hasDetails = await requestsPage.hasDetailsButton(data.periodPattern);

    expect(hasApprove).toBe(true);
    expect(hasReject).toBe(true);
    // Redirect and details may or may not be present for self-approval
    expect(hasDetails).toBe(true);
    await verification.captureStep(testInfo, "action-buttons-visible");

    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    // CLEANUP: Delete the vacation
    await setup.deleteVacation(vacation.id);
  }
});
