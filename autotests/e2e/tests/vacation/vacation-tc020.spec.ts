import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc020Data } from "../../data/vacation/VacationTc020Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { VacationCreationFixture } from "@ttt/fixtures/VacationCreationFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { EmployeeRequestsPage } from "@ttt/pages/EmployeeRequestsPage";
import { DbClient } from "@ttt/config/db/dbClient";
import { findVacationId } from "../../data/vacation/queries/vacationQueries";

/**
 * TC-VAC-020: Change approver (redirect request).
 * Two-login test:
 *   1. Login as subordinate → create vacation via UI → logout
 *   2. Login as manager (pvaynmaster) → Employee Requests → Approval → redirect to alt_manager
 * Bug #2718 (OPEN): Redirected approved/rejected request doesn't reset status to NEW.
 */
test("TC-VAC-020: Change approver — redirect request @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc020Data.create(
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

  // Clear browser state for clean second login (CAS SSO)
  await page.goto(tttConfig.appUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto("about:blank");

  // === PHASE 2: Login as manager, redirect to alternative manager ===

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

  // Step 2: Find the subordinate's vacation
  await requestsPage.waitForRequestRow(data.employeeName, data.periodPattern);
  await verification.captureStep(testInfo, "vacation-in-approval-queue");

  // Step 3: Click redirect button
  await requestsPage.redirectRequest(data.employeeName, data.periodPattern);
  await globalConfig.delay();

  // Step 4: Select alternative manager in the redirect dialog
  await requestsPage.selectRedirectTarget(data.altManagerName);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "alt-manager-selected");

  // Step 5: Confirm redirect
  await requestsPage.confirmRedirect();
  await globalConfig.delay();

  // Step 6: Verify request disappeared from current approver's Approval queue
  await requestsPage.waitForRequestRowToDisappear(
    data.employeeName,
    data.periodPattern,
  );
  await verification.captureStep(testInfo, "vacation-redirected-disappeared");

  // DB-CHECK: verify approver changed to alt_manager
  const db2 = new DbClient(tttConfig);
  try {
    const dbRow = await db2.queryOne<{ approver_login: string }>(
      `SELECT m.login AS approver_login
       FROM ttt_vacation.vacation v
       JOIN ttt_vacation.employee m ON v.approver = m.id
       WHERE v.id = $1`,
      [vacationId],
    );
    expect(dbRow.approver_login).toBe(data.altManagerLogin);
  } finally {
    await db2.close();
  }

  await mgrLogout.runViaDirectUrl();

  // CLEANUP: Delete the vacation via API
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
