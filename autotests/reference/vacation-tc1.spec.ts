import { test } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc1Data } from "../data/VacationTc1Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("vacation_tc1 - create unpaid vacation request and remove @regress", async ({ page }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc1Data.create(globalConfig.testDataMode, tttConfig);

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // 3. Fixtures
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const vacationDeletion = new VacationDeletionFixture(page, globalConfig);

  // Step 1: Sign in
  await login.run();

  // Step 2: Ensure English
  await mainFixture.ensureLanguage("EN");

  // Step 3: Navigate to My vacations and days off
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await verification.verifyLocatorVisible(
    vacationsPage.titleLocator(),
    testInfo,
    "vacations-page-loaded",
  );

  // Cleanup: remove any leftover vacation from a previous run
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Step 4: Open create request dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Step 5: Fill vacation period
  await dialog.fillVacationPeriod(data.startDate, data.endDate);

  // Step 6: Enable unpaid vacation
  await dialog.ensureUnpaidVacationChecked();

  // Step 7: Fill comment
  await dialog.fillComment(data.comment);

  // Step 8: Verify no red error text
  await dialog.assertNoDominantRedText();

  // Step 9: Submit and verify green success notification
  await dialog.submit();
  const notification = await vacationsPage.findNotification(
    data.notificationText,
  );
  await verification.verifyLocatorDominantGreen(
    notification,
    testInfo,
    "success-notification-green",
  );

  // Step 10: Verify table columns for the new vacation row
  await vacationsPage.waitForVacationRow(data.periodPattern);

  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    data.expectedStatus,
    testInfo,
    "column-status-new",
  );

  const typeCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Vacation type",
  );
  await verification.verifyLocatorText(
    typeCell,
    data.expectedVacationType,
    testInfo,
    "column-type-administrative",
  );

  const paymentCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Payment month",
  );
  await verification.verifyLocatorEmpty(
    paymentCell,
    testInfo,
    "column-payment-month-blank",
  );

  // Step 11: Open details dialog and verify submitted data
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await verification.verifyLocatorText(
    detailsDialog.root(),
    data.expectedVacationType,
    testInfo,
    "details-vacation-type",
  );
  await verification.verifyLocatorText(
    detailsDialog.root(),
    data.expectedStatus,
    testInfo,
    "details-status",
  );
  await verification.verifyLocatorText(
    detailsDialog.root(),
    data.comment,
    testInfo,
    "details-comment",
  );

  // Step 12: Delete the request via details dialog and verify it disappears
  await detailsDialog.deleteRequest();
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await verification.verifyLocatorVisible(
    vacationsPage.titleLocator(),
    testInfo,
    "vacation-deleted-page-intact",
  );

  // Step 13: Logout
  await logout.runViaDirectUrl();
  await page.close();
});
