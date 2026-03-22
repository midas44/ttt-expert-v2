import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc046Data } from "../data/VacationTc046Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { EmployeeRequestsPage } from "../pages/EmployeeRequestsPage";

test("TC-VAC-046 - Reject vacation — verify days returned @regress", async ({
  page,
  browser,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc046Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

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

  // Cleanup leftover from previous runs
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Re-read days after cleanup
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await globalConfig.delay();
  // Wait for available days counter to load (async API call)
  await page.locator("text=/Available vacation days/").waitFor({ state: "visible" });
  await globalConfig.delay();
  const daysBefore = await vacationsPage.getAvailableDays();

  // Create vacation
  await vacationCreation.createVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });
  await globalConfig.delay();

  const daysAfterCreate = await vacationsPage.getAvailableDays();
  expect(
    daysAfterCreate,
    "Days should decrease after vacation creation",
  ).toBeLessThan(daysBefore);

  // === PHASE 2: Manager rejects the vacation ===
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

  // Reject the vacation (filter by both name AND period to avoid ambiguity)
  await requestsPage.waitForRequestRow(data.employeeName, data.periodPattern);
  await requestsPage.rejectRequest(data.employeeName, data.periodPattern);
  await globalConfig.delay();
  await requestsPage.waitForRequestRowToDisappear(data.employeeName, data.periodPattern);

  await managerPage.close();
  await managerContext.close();

  // === PHASE 3: Employee verifies days restored ===
  // Reload the employee page to bypass cached available-days data
  await page.reload();
  await vacationsPage.waitForReady();
  await page.locator("text=/Available vacation days/").waitFor({ state: "visible" });
  await globalConfig.delay();

  const daysAfterReject = await vacationsPage.getAvailableDays();
  expect(
    daysAfterReject,
    "Days should be restored after rejection",
  ).toBe(daysBefore);

  // Verify status is "Rejected" under Closed tab
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
    "status-rejected",
  );

  // === Cleanup ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
