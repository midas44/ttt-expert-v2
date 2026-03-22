import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc033Data } from "../data/VacationTc033Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { EmployeeRequestsPage } from "../pages/EmployeeRequestsPage";
import { DbClient } from "../config/db/dbClient";
import { findVacationId } from "../data/queries/vacationQueries";

test("TC-VAC-033 - Re-approve REJECTED vacation without edit @regress", async ({
  page,
  browser,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc033Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // === PHASE 1: Login as employee, create a NEW vacation ===
  const employeeLogin = new LoginFixture(
    page,
    tttConfig,
    data.employeeLogin,
    globalConfig,
  );
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const vacationCreation = new VacationCreationFixture(page, globalConfig);
  const vacationDeletion = new VacationDeletionFixture(page, globalConfig);

  await employeeLogin.run();
  await mainFixture.ensureLanguage("EN");

  // Navigate to My vacations and create
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Cleanup leftover from previous runs
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Create vacation
  await vacationCreation.createVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });
  await globalConfig.delay();

  // === PHASE 2: Manager rejects the NEW vacation via Approval tab ===
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await globalConfig.applyViewport(managerPage);

  const managerLoginFixture = new LoginFixture(
    managerPage,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  await managerLoginFixture.run();
  const managerMain = new MainFixture(managerPage, tttConfig, globalConfig);
  await managerMain.ensureLanguage("EN");

  const managerNavigation = new HeaderNavigationFixture(
    managerPage,
    globalConfig,
  );
  await managerNavigation.navigate(
    "Calendar of absences > Employees requests",
  );
  const requestsPage = new EmployeeRequestsPage(managerPage);
  await requestsPage.waitForReady();

  // Click "Approval" sub-tab and reject
  await requestsPage.clickApprovalTab();
  await globalConfig.delay();
  await requestsPage.waitForRequestRow(data.employeeName, data.periodPattern);
  await requestsPage.rejectRequest(data.employeeName, data.periodPattern);
  await globalConfig.delay();
  await requestsPage.waitForRequestRowToDisappear(data.employeeName, data.periodPattern);

  // === PHASE 3: Re-approve the REJECTED vacation via API ===
  // The My department tab has heavy pagination making UI re-approval unreliable.
  // Use the manager's browser context to call the approve API (session auth).
  const db = new DbClient(tttConfig);
  const startIso = data.startDate.split(".").reverse().join("-");
  const endIso = data.endDate.split(".").reverse().join("-");
  const vacationId = await findVacationId(
    db,
    data.employeeLogin,
    startIso,
    endIso,
  );
  await db.close();

  // Capture the JWT from a network request the app makes
  let managerJwt = "";
  managerPage.on("request", (req) => {
    const header = req.headers()["ttt_jwt_token"]
      || req.headers()["authorization"];
    if (header && !managerJwt) {
      managerJwt = header.replace(/^Bearer\s+/i, "");
    }
  });

  // Trigger a navigation to capture an API request with the JWT
  await managerPage.reload({ waitUntil: "networkidle" });
  expect(managerJwt, "Manager JWT not captured from network requests").toBeTruthy();

  // Close manager context
  await managerPage.close();
  await managerContext.close();

  // Approve via vacation API using manager's JWT
  const approveResp = await page.request.put(
    tttConfig.buildUrl(`/api/vacation/v1/vacations/approve/${vacationId}`),
    { headers: { TTT_JWT_TOKEN: managerJwt } },
  );
  expect(approveResp.ok(), `Failed to approve vacation: ${approveResp.status()}`).toBeTruthy();
  await globalConfig.delay();

  // === PHASE 4: Back on employee page — verify status = "Approved" ===
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  const verification = new VerificationFixture(page, globalConfig);
  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    "Approved",
    testInfo,
    "status-approved-after-re-approval",
  );

  // Cleanup: delete the vacation
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Logout employee
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
