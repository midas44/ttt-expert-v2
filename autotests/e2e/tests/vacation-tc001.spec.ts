import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc001Data } from "../data/VacationTc001Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-001 - Create regular vacation request — happy path @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc001Data.create(
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

  // Cleanup: remove leftover from previous run
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Step 4: Note available vacation days
  const daysBefore = await vacationsPage.getAvailableDays();

  // Step 5: Click "Create a request"
  const dialog = await vacationsPage.openCreateRequest();

  // Step 6-8: Fill vacation dates (next Mon–Fri)
  await dialog.fillVacationPeriod(data.startDate, data.endDate);

  // Step 10: Verify unpaid checkbox is unchecked (Regular type)
  await expect(dialog.unpaidCheckboxLocator()).not.toBeChecked();

  // Step 8: Verify no red error text in dialog
  await dialog.assertNoDominantRedText();

  // Step 13: Submit
  await dialog.submit();

  // Step 14: Verify success notification
  const notification = await vacationsPage.findNotification(
    data.notificationText,
  );
  await verification.verifyLocatorDominantGreen(
    notification,
    testInfo,
    "success-notification-green",
  );

  // Step 15: Verify row appears with correct status and type
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
    "column-type-regular",
  );

  // Step 17: Verify available days decreased
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(daysAfter).toBeLessThan(daysBefore);

  // Cleanup: delete the created vacation
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Logout
  await logout.runViaDirectUrl();
  await page.close();
});
