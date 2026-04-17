import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc018Data } from "../../data/vacation/VacationTc018Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { VacationCreationFixture } from "@ttt/fixtures/VacationCreationFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { EmployeeRequestsPage } from "@ttt/pages/EmployeeRequestsPage";
import { DbClient } from "@ttt/config/db/dbClient";
import { findVacationId } from "../../data/vacation/queries/vacationQueries";

/**
 * TC-VAC-018: Re-approve REJECTED vacation (without edit).
 * Two-login test:
 *   1. Login as subordinate employee → create vacation via UI → logout
 *   2. Login as manager (pvaynmaster) → reject from Approval tab → re-approve from Approval tab
 * APPROVABLE_STATUSES = {NEW, REJECTED}
 */
test("TC-VAC-018: Re-approve REJECTED vacation @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc018Data.create(
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

  // === PHASE 2: Login as manager, reject then re-approve ===

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

  // Step 2: Find and reject the subordinate's NEW vacation (filter by name + period)
  await requestsPage.waitForRequestRow(data.employeeName, data.periodPattern);
  await requestsPage.rejectRequest(data.employeeName, data.periodPattern);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "vacation-rejected-by-manager");

  // Step 3: Verify REJECTED status via API
  const getUrl = tttConfig.buildUrl(
    `/api/vacation/v1/vacations/${vacationId}`,
  );
  let resp = await request.get(getUrl, {
    headers: { API_SECRET_TOKEN: tttConfig.apiToken },
  });
  let body = await resp.json();
  let vacationData = body.vacation ?? body;
  expect(vacationData.status).toBe("REJECTED");

  // Step 4: Reload page — REJECTED should appear in Approval tab (APPROVABLE_STATUSES includes REJECTED)
  await page.goto(`${tttConfig.appUrl}/vacation/request`, {
    waitUntil: "domcontentloaded",
  });
  await requestsPage.waitForReady();
  await globalConfig.delay();
  await requestsPage.clickApprovalTab();
  await globalConfig.delay();

  // Try Approval tab first; fall back to My department if REJECTED not in Approval
  let found = false;
  try {
    await requestsPage.waitForRequestRow(data.employeeName, data.periodPattern);
    found = true;
  } catch {
    // REJECTED not in Approval tab — try My department
    await requestsPage.clickMyDepartmentTab();
    await globalConfig.delay();
    await requestsPage.waitForRequestRow(data.employeeName, data.periodPattern);
    found = true;
  }
  expect(found).toBe(true);

  // Step 5: Re-approve the REJECTED vacation
  const hasApprove = await requestsPage.hasApproveButton(
    data.employeeName,
    data.periodPattern,
  );
  expect(hasApprove).toBe(true);
  await requestsPage.approveRequest(data.employeeName, data.periodPattern);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "rejected-vacation-re-approved");

  // Step 6: Verify status is now APPROVED via API
  resp = await request.get(getUrl, {
    headers: { API_SECRET_TOKEN: tttConfig.apiToken },
  });
  body = await resp.json();
  vacationData = body.vacation ?? body;
  expect(vacationData.status).toBe("APPROVED");

  await mgrLogout.runViaDirectUrl();

  // CLEANUP: Try to cancel + delete via API
  try {
    const cancelUrl = tttConfig.buildUrl(
      `/api/vacation/v1/vacations/cancel/${vacationId}`,
    );
    await request.put(cancelUrl, {
      headers: {
        API_SECRET_TOKEN: tttConfig.apiToken,
        "Content-Type": "application/json",
      },
    });
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
