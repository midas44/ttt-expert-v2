import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc087Data } from "../../data/vacation/VacationTc087Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { EmployeeRequestsPage } from "../../pages/EmployeeRequestsPage";

/**
 * TC-VAC-087: Non-approver cannot approve vacation.
 * SETUP: Creates a vacation for pvaynmaster (CPO, self-assigned approver).
 * UI: Logs in as Manager B (different manager), verifies vacation NOT in their queue.
 * API: Tries to approve a foreign vacation (approver != pvaynmaster) → expects 400.
 * hasAccess() checks approver_id match.
 */
test("TC-VAC-087: Non-approver cannot approve vacation @regress @vacation @permissions", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc087Data.create(globalConfig.testDataMode, tttConfig);
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.managerBLogin, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const requestsPage = new EmployeeRequestsPage(page);

  // SETUP: Create vacation for pvaynmaster (CPO self-approver)
  const vacation = await setup.createVacation(data.startDateIso, data.endDateIso);

  try {
    // Step 1: Login as Manager B (NOT pvaynmaster's approver)
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2-3: Navigate to Employee Requests → Approval tab
    await page.goto(`${tttConfig.appUrl}/vacation/request`, { waitUntil: "domcontentloaded" });
    await requestsPage.waitForReady();
    await globalConfig.delay();
    await requestsPage.clickApprovalTab();
    await globalConfig.delay();

    // Step 4: Verify pvaynmaster's vacation does NOT appear in Manager B's queue
    const rows = requestsPage.requestRow(data.tokenOwnerName, data.periodPattern);
    const rowCount = await rows.count();
    expect(rowCount).toBe(0);
    await verification.captureStep(testInfo, "vacation-not-in-manager-b-queue");

    // Step 5: API — try to approve a foreign vacation as pvaynmaster (non-approver)
    if (data.foreignVacationId > 0) {
      const approveResult = await setup.rawPut(
        `/api/vacation/v1/vacations/approve/${data.foreignVacationId}`,
      );
      // Expect 400 because pvaynmaster is not the assigned approver
      expect(approveResult.status).toBeGreaterThanOrEqual(400);
      await verification.captureStep(testInfo, "api-approve-rejected");
    }
  } finally {
    // CLEANUP
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
