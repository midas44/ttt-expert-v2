import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc017Data } from "../../data/vacation/VacationTc017Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { VacationCreationFixture } from "../../fixtures/VacationCreationFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";
import { EmployeeRequestsPage } from "../../pages/EmployeeRequestsPage";
import { DbClient } from "../../config/db/dbClient";
import { findVacationId } from "../../data/vacation/queries/vacationQueries";

/**
 * TC-VAC-017: Reject APPROVED vacation.
 * Two-login test:
 *   1. Login as subordinate employee → create vacation via UI → logout
 *   2. Login as manager (pvaynmaster) → approve from Approval tab → reject from My department tab
 * REJECTABLE_STATUSES = {NEW, APPROVED}
 */
test("TC-VAC-017: Reject APPROVED vacation @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(180_000); // extended timeout for two-login test
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc017Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const verification = new VerificationFixture(page, globalConfig);
  const requestsPage = new EmployeeRequestsPage(page);
  let vacationId = 0;

  // === PHASE 1: Login as subordinate employee, create vacation via UI ===

  const empLogin = new LoginFixture(
    page,
    tttConfig,
    data.employeeLogin,
    globalConfig,
  );
  const empLogout = new LogoutFixture(page, tttConfig, globalConfig);

  await empLogin.run();
  const mainPage1 = new MainPage(page);
  if ((await mainPage1.getCurrentLanguage()) !== "EN") {
    await mainPage1.setLanguage("EN");
    await globalConfig.delay();
  }

  // Navigate to My Vacations and create vacation
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  const vacCreation = new VacationCreationFixture(page, globalConfig);
  await vacCreation.ensureOnPage();
  await vacCreation.createVacation(data);
  await verification.captureStep(testInfo, "employee-vacation-created");

  // Find the vacation ID from DB
  const db = new DbClient(tttConfig);
  try {
    vacationId = await findVacationId(
      db,
      data.employeeLogin,
      data.startDateIso,
      data.endDateIso,
    );
  } finally {
    await db.close();
  }

  await empLogout.runViaDirectUrl();

  // Completely reset browser state for clean second login (CAS SSO)
  // Must clear storage on the app's domain, then clear cookies
  await page.goto(tttConfig.appUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto("about:blank");

  // === PHASE 2: Login as manager, approve then reject ===

  const mgrLogin = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  const mgrLogout = new LogoutFixture(page, tttConfig, globalConfig);

  await mgrLogin.run();
  const mainPage2 = new MainPage(page);
  if ((await mainPage2.getCurrentLanguage()) !== "EN") {
    await mainPage2.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 1: Navigate to Employee Requests → Approval tab
  await page.goto(`${tttConfig.appUrl}/vacation/request`, {
    waitUntil: "domcontentloaded",
  });
  await requestsPage.waitForReady();
  await globalConfig.delay();
  await requestsPage.clickApprovalTab();
  await globalConfig.delay();

  // Step 2: Find and approve the subordinate's NEW vacation (filter by name + period)
  await requestsPage.waitForRequestRow(data.employeeName, data.periodPattern);
  await requestsPage.approveRequest(data.employeeName, data.periodPattern);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "vacation-approved-by-manager");

  // Step 3: Navigate to My department tab to find the APPROVED vacation
  await requestsPage.clickMyDepartmentTab();
  await globalConfig.delay();
  const approvedRow = await requestsPage.waitForRequestRow(
    data.employeeName,
    data.periodPattern,
  );
  await expect(approvedRow.first()).toBeVisible();
  const statusText = await requestsPage.columnValue(
    "Status",
    data.employeeName,
    data.periodPattern,
  );
  expect(statusText.toLowerCase()).toContain("approved");
  await verification.captureStep(testInfo, "approved-visible-in-mydepartment");

  // Step 4: Reject the APPROVED vacation
  await requestsPage.rejectRequest(data.employeeName, data.periodPattern);
  await globalConfig.delay();

  // Step 5: Verify status is now REJECTED via API
  const getUrl = tttConfig.buildUrl(
    `/api/vacation/v1/vacations/${vacationId}`,
  );
  const resp = await request.get(getUrl, {
    headers: { API_SECRET_TOKEN: tttConfig.apiToken },
  });
  const body = await resp.json();
  const vacationData = body.vacation ?? body;
  expect(vacationData.status).toBe("REJECTED");
  await verification.captureStep(testInfo, "vacation-now-rejected");

  await mgrLogout.runViaDirectUrl();

  // CLEANUP: Try to delete the vacation via API
  try {
    const delUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/${vacationId}`,
    );
    await request.delete(delUrl, {
      headers: {
        API_SECRET_TOKEN: tttConfig.apiToken,
        "Content-Type": "application/json",
      },
    });
  } catch {
    /* cleanup best-effort */
  }

  await page.close();
});
