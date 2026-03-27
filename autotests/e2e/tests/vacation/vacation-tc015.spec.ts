import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc015Data } from "../../data/vacation/VacationTc015Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { EmployeeRequestsPage } from "../../pages/EmployeeRequestsPage";

/**
 * TC-VAC-015: Approve NEW vacation — happy path.
 * SETUP: Creates a NEW vacation via API for pvaynmaster (CPO, self-approver).
 * Test: login → Employee Requests → Approval tab → approve → verify APPROVED.
 */
test("TC-VAC-015: Approve NEW vacation — happy path @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc015Data.create(
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

    // Step 4-5: Click Approval tab, find the vacation
    await requestsPage.clickApprovalTab();
    await globalConfig.delay();
    await requestsPage.waitForRequestRow(data.periodPattern);
    await verification.captureStep(testInfo, "vacation-in-approval-queue");

    // Step 6: Click approve button
    await requestsPage.approveRequest(data.periodPattern);
    await globalConfig.delay();

    // Step 7: Verify row disappears from Approval list
    await requestsPage.waitForRequestRowToDisappear(data.periodPattern);
    await verification.captureStep(testInfo, "vacation-approved-disappeared");

    // Step 8: DB-CHECK — verify status is APPROVED
    // Navigate to My Vacations to confirm the vacation is now APPROVED
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    await globalConfig.delay();
    // Check via API: GET the vacation to confirm status
    const getUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/${vacation.id}`,
    );
    const resp = await request.get(getUrl, {
      headers: { API_SECRET_TOKEN: tttConfig.apiToken },
    });
    const body = await resp.json();
    const vacationData = body.vacation ?? body;
    expect(vacationData.status).toBe("APPROVED");

    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    // CLEANUP: Cancel + delete the vacation (APPROVED → CANCELED → DELETED)
    try {
      await setup.cancelVacation(vacation.id);
    } catch {
      /* already canceled or deleted */
    }
    await setup.deleteVacation(vacation.id);
  }
});
