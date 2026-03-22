import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc045Data } from "../data/VacationTc045Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { EmployeeRequestsPage } from "../pages/EmployeeRequestsPage";

test("TC-VAC-045 - Approve vacation — verify days deducted @regress", async ({
  page,
  browser,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc045Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // === PHASE 1: Login as employee, note available days, create vacation ===
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
  const verification = new VerificationFixture(page, globalConfig);

  await employeeLogin.run();
  await mainFixture.ensureLanguage("EN");

  // Navigate to My vacations
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Note available days BEFORE creation
  const daysBefore = await vacationsPage.getAvailableDays();

  // Cleanup leftover from previous runs
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Re-read days after cleanup (in case cleanup restored days)
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  const daysBeforeClean = await vacationsPage.getAvailableDays();

  // Create vacation
  await vacationCreation.createVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });
  await globalConfig.delay();

  // Note available days AFTER creation — should be less (days consumed at creation)
  const daysAfterCreate = await vacationsPage.getAvailableDays();
  expect(
    daysAfterCreate,
    "Days should decrease after vacation creation",
  ).toBeLessThan(daysBeforeClean);

  // === PHASE 2: Manager approves in a separate browser context ===
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

  // Approve the vacation
  await requestsPage.waitForRequestRow(data.employeeName);
  await requestsPage.approveRequest(data.employeeName);
  await globalConfig.delay();
  await requestsPage.waitForRequestRowToDisappear(data.employeeName);

  await managerPage.close();
  await managerContext.close();

  // === PHASE 3: Back on employee page — verify days unchanged (consumed at creation, confirmed at approval) ===
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  const daysAfterApproval = await vacationsPage.getAvailableDays();

  // Days should be the same as after creation — approval confirms but doesn't re-deduct
  expect(
    daysAfterApproval,
    "Days after approval should equal days after creation (no re-deduction)",
  ).toBe(daysAfterCreate);

  // Verify status is "Approved"
  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    "Approved",
    testInfo,
    "status-approved",
  );

  // === Cleanup: delete the approved vacation ===
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
