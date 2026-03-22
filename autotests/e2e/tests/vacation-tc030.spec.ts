import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc030Data } from "../data/VacationTc030Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { EmployeeRequestsPage } from "../pages/EmployeeRequestsPage";

test("TC-VAC-030 - Delete CANCELED vacation @regress", async ({
  page,
  browser,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc030Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // === PHASE 1: Employee creates a NEW vacation ===
  const employeeLoginFixture = new LoginFixture(
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

  await employeeLoginFixture.run();
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

  // === PHASE 2: Manager approves the vacation ===
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

  await managerPage.close();
  await managerContext.close();

  // === PHASE 3: Employee cancels the APPROVED vacation ===
  // Refresh to see updated status
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Verify status = "Approved" in Open tab
  const verification = new VerificationFixture(page, globalConfig);
  const approvedStatus = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    approvedStatus,
    "Approved",
    testInfo,
    "status-approved-before-cancel",
  );

  // Cancel the approved vacation (via details dialog → delete)
  const detailsForCancel = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsForCancel.deleteRequest();
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await globalConfig.delay();

  // === PHASE 4: Verify CANCELED status, then delete ===
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();
  await vacationsPage.waitForVacationRow(data.periodPattern);

  // Verify status is "Canceled" or "Deleted"
  const canceledStatus = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  const canceledText = (await canceledStatus.textContent())?.trim() ?? "";
  expect(
    canceledText.includes("Canceled") || canceledText.includes("Deleted"),
    `Expected Canceled or Deleted, got: ${canceledText}`,
  ).toBeTruthy();

  if (canceledText.includes("Canceled")) {
    // Delete the canceled vacation (only if not already Deleted)
    const detailsForDelete = await vacationsPage.openRequestDetails(
      data.periodPattern,
    );
    await detailsForDelete.deleteRequest();
    await globalConfig.delay();
  }

  // Verify final status = "Deleted" in All tab
  await vacationsPage.clickAllTab();
  await globalConfig.delay();
  const allRow = vacationsPage.vacationRow(data.periodPattern);
  await allRow.first().waitFor({ state: "visible" });
  const deletedStatus = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    deletedStatus,
    "Deleted",
    testInfo,
    "status-deleted-in-all-tab",
  );

  // Logout
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
