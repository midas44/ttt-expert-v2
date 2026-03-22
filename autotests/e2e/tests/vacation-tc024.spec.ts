import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc024Data } from "../data/VacationTc024Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-024 - Delete NEW vacation @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc024Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // 3. Fixtures
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const vacationCreation = new VacationCreationFixture(page, globalConfig);
  const vacationDeletion = new VacationDeletionFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Navigate to My vacations
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Cleanup any leftover from previous runs
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Note available days before creation
  const daysBefore = await vacationsPage.getAvailableDays();

  // Step 2: Create a NEW vacation
  await vacationCreation.createVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Verify status is NEW
  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    "New",
    testInfo,
    "status-new-before-delete",
  );

  // Step 4-5: Delete the vacation via details dialog
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await globalConfig.delay();

  // Step 6: Verify vacation disappears from "Open" tab
  const openRowCount = await vacationsPage
    .vacationRow(data.periodPattern)
    .count();
  expect(openRowCount).toBe(0);

  // Step 7-8: Switch to "All" tab, verify status = "Deleted"
  await vacationsPage.clickAllTab();
  await globalConfig.delay();

  const allRow = vacationsPage.vacationRow(data.periodPattern);
  await allRow.first().waitFor({ state: "visible" });
  const deletedStatusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    deletedStatusCell,
    data.expectedDeletedStatus,
    testInfo,
    "status-deleted-in-all-tab",
  );

  // Step 9: Verify available days restored
  await vacationsPage.clickOpenTab();
  await globalConfig.delay();
  const daysAfterDelete = await vacationsPage.getAvailableDays();
  expect(daysAfterDelete).toBe(daysBefore);

  // Logout
  await logout.runViaDirectUrl();
  await page.close();
});
