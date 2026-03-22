import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc032Data } from "../data/VacationTc032Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { EmployeeRequestsPage } from "../pages/EmployeeRequestsPage";

test("TC-VAC-032 - Reject NEW vacation request (manager view) @regress", async ({
  page,
  browser,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc032Data.create(
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

  // === PHASE 2: Manager rejects in a separate browser context ===
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

  // Navigate to Employees requests → Approval
  const managerNavigation = new HeaderNavigationFixture(
    managerPage,
    globalConfig,
  );
  await managerNavigation.navigate(
    "Calendar of absences > Employees requests",
  );
  const requestsPage = new EmployeeRequestsPage(managerPage);
  await requestsPage.waitForReady();

  // Click "Approval" sub-tab
  await requestsPage.clickApprovalTab();
  await globalConfig.delay();

  // Locate the employee's request and reject
  await requestsPage.waitForRequestRow(data.employeeName);
  await requestsPage.rejectRequest(data.employeeName);
  await globalConfig.delay();

  // Verify vacation disappears from pending list
  await requestsPage.waitForRequestRowToDisappear(data.employeeName);

  // Close manager context
  await managerPage.close();
  await managerContext.close();

  // === PHASE 3: Back on employee page — verify status = "Rejected" ===
  // Refresh the employee's My Vacations page
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Rejected vacations appear in "Closed" tab
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();

  // Verify status is "Rejected"
  const verification = new VerificationFixture(page, globalConfig);
  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    "Rejected",
    testInfo,
    "status-rejected-after-manager-rejection",
  );

  // Cleanup: delete the rejected vacation
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  // Logout employee
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
