import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc035Data } from "../data/VacationTc035Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { EmployeeRequestsPage } from "../pages/EmployeeRequestsPage";

test("TC-VAC-035 - Redirect vacation request to another manager @regress", async ({
  page,
  browser,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc035Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // === PHASE 1: Employee creates a vacation ===
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

  // Cleanup leftover
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

  // === PHASE 2: Original manager redirects to another manager ===
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

  // Find and redirect the vacation request
  await requestsPage.waitForRequestRow(data.employeeName);
  await requestsPage.redirectRequest(data.employeeName);
  await globalConfig.delay();

  // Select the alternative manager in the redirect dialog
  await requestsPage.selectRedirectTarget(data.altManagerName);
  await globalConfig.delay();
  await requestsPage.confirmRedirect();
  await globalConfig.delay();

  // Verify vacation disappears from original manager's list
  await requestsPage.waitForRequestRowToDisappear(data.employeeName);

  const verification = new VerificationFixture(managerPage, globalConfig);
  await verification.verify("Employees requests", testInfo);

  await managerPage.close();
  await managerContext.close();

  // === PHASE 3: New manager sees the vacation in their Approval list ===
  const altManagerContext = await browser.newContext();
  const altManagerPage = await altManagerContext.newPage();
  await globalConfig.applyViewport(altManagerPage);

  const altManagerLogin = new LoginFixture(
    altManagerPage,
    tttConfig,
    data.altManagerLogin,
    globalConfig,
  );
  await altManagerLogin.run();
  const altManagerMain = new MainFixture(
    altManagerPage,
    tttConfig,
    globalConfig,
  );
  await altManagerMain.ensureLanguage("EN");

  const altManagerNavigation = new HeaderNavigationFixture(
    altManagerPage,
    globalConfig,
  );
  await altManagerNavigation.navigate(
    "Calendar of absences > Employees requests",
  );
  const altRequestsPage = new EmployeeRequestsPage(altManagerPage);
  await altRequestsPage.waitForReady();
  await altRequestsPage.clickApprovalTab();
  await globalConfig.delay();

  // Verify vacation appears in the new manager's Approval list
  await altRequestsPage.waitForRequestRow(data.employeeName);
  const altVerification = new VerificationFixture(
    altManagerPage,
    globalConfig,
  );
  await altVerification.verify("Employees requests", testInfo);

  // Cleanup: approve it from alt manager to enable deletion
  await altRequestsPage.approveRequest(data.employeeName);
  await globalConfig.delay();

  await altManagerPage.close();
  await altManagerContext.close();

  // === PHASE 4: Cleanup — delete the vacation ===
  // Employee page is still open — refresh
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
