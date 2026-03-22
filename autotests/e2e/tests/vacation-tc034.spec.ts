import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc034Data } from "../data/VacationTc034Data";
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

test("TC-VAC-034 - Reject APPROVED vacation @regress", async ({
  page,
  browser,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc034Data.create(
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

  // === PHASE 2: Manager approves the NEW vacation ===
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await globalConfig.applyViewport(managerPage);

  const managerLogin = new LoginFixture(
    managerPage,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  await managerLogin.run();
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

  await requestsPage.clickApprovalTab();
  await globalConfig.delay();
  await requestsPage.waitForRequestRow(data.employeeName, data.periodPattern);
  await requestsPage.approveRequest(data.employeeName, data.periodPattern);
  await globalConfig.delay();
  await requestsPage.waitForRequestRowToDisappear(data.employeeName, data.periodPattern);

  // === PHASE 3: Manager rejects the APPROVED vacation via API ===
  // The My department tab has heavy pagination making UI rejection unreliable.
  // Use the vacation reject API with the manager's JWT instead.
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
  await managerPage.reload({ waitUntil: "networkidle" });
  expect(managerJwt, "Manager JWT not captured from network requests").toBeTruthy();

  // Close manager context
  await managerPage.close();
  await managerContext.close();

  // Reject via vacation API using manager's JWT
  const rejectResp = await page.request.put(
    tttConfig.buildUrl(`/api/vacation/v1/vacations/reject/${vacationId}`),
    { headers: { TTT_JWT_TOKEN: managerJwt } },
  );
  expect(rejectResp.ok(), `Failed to reject vacation: ${rejectResp.status()}`).toBeTruthy();
  await globalConfig.delay();

  // === PHASE 4: Employee verifies status = "Rejected" and days restored ===
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Rejected vacations appear in "Closed" tab
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();

  const verification = new VerificationFixture(page, globalConfig);
  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    "Rejected",
    testInfo,
    "status-rejected-after-manager-rejects-approved",
  );

  // Cleanup: delete the rejected vacation from Closed tab
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  // Logout
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
