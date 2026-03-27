import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc016Data } from "../../data/vacation/VacationTc016Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { EmployeeRequestsPage } from "../../pages/EmployeeRequestsPage";

/**
 * TC-VAC-016: Reject NEW vacation.
 * SETUP: Creates a NEW vacation via API for pvaynmaster.
 * Test: login → Employee Requests → Approval tab → reject → verify REJECTED.
 */
test("TC-VAC-016: Reject NEW vacation @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc016Data.create(
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

    // Step 4: Click Approval tab, find the vacation
    await requestsPage.clickApprovalTab();
    await globalConfig.delay();
    await requestsPage.waitForRequestRow(data.periodPattern);
    await verification.captureStep(testInfo, "vacation-in-approval-queue");

    // Step 5: Click reject button
    await requestsPage.rejectRequest(data.periodPattern);
    await globalConfig.delay();

    // Step 6: Verify row disappears from Approval list
    await requestsPage.waitForRequestRowToDisappear(data.periodPattern);
    await verification.captureStep(testInfo, "vacation-rejected-disappeared");

    // Step 7: DB-CHECK — verify status is REJECTED via API
    const getUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/${vacation.id}`,
    );
    const resp = await request.get(getUrl, {
      headers: { API_SECRET_TOKEN: tttConfig.apiToken },
    });
    const body = await resp.json();
    const vacationData = body.vacation ?? body;
    expect(vacationData.status).toBe("REJECTED");

    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    // CLEANUP: Delete the vacation (REJECTED can be deleted directly)
    await setup.deleteVacation(vacation.id);
  }
});
