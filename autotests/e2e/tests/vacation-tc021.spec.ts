import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc021Data } from "../data/VacationTc021Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { VacationDetailsDialog } from "../pages/VacationDetailsDialog";

test("TC-VAC-021 - Cancel NEW vacation request @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc021Data.create(
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

  // Cleanup: remove leftover from previous run
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Note available days before
  const daysBefore = await vacationsPage.getAvailableDays();

  // Create a NEW vacation
  const dialog = await vacationsPage.openCreateRequest();
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await dialog.assertNoDominantRedText();
  await dialog.submit();
  await vacationsPage.findNotification(data.notificationText);
  await vacationsPage.waitForVacationRow(data.periodPattern);
  await globalConfig.delay();

  // Step 4-7: Cancel the vacation via Request Details → Delete
  // In the UI, "cancel" is the Delete button in the Request Details dialog
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();

  // Step 8: Verify vacation disappears from Open tab
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await globalConfig.delay();

  // Step 9: Verify vacation appears in Closed tab
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();
  await vacationsPage.waitForVacationRow(data.periodPattern);

  // Verify status shows as "Deleted" or "Canceled" in Closed tab
  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  const statusText = await statusCell.textContent();
  expect(
    statusText?.includes("Deleted") || statusText?.includes("Canceled"),
    `Expected status to be Deleted or Canceled, got: ${statusText}`,
  ).toBeTruthy();

  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(data.periodPattern).first(),
    testInfo,
    "vacation-in-closed-tab",
  );

  // Step 10: Verify available days restored
  await vacationsPage.clickOpenTab();
  await globalConfig.delay();
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(daysAfter).toBeGreaterThanOrEqual(daysBefore);

  // Logout
  await logout.runViaDirectUrl();
  await page.close();
});
