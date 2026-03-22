import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc002Data } from "../data/VacationTc002Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-002 - Create administrative (unpaid) vacation request @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc002Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

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

  // Step 2: Navigate to My vacations and days off
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Cleanup leftover from previous run
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Step 3: Note available vacation days before
  const daysBefore = await vacationsPage.getAvailableDays();

  // Step 4: Create unpaid vacation
  const dialog = await vacationsPage.openCreateRequest();
  await dialog.fillVacationPeriod(data.startDate, data.endDate);

  // Step 6: Check the "Unpaid vacation" checkbox
  await dialog.ensureUnpaidVacationChecked();
  await dialog.assertNoDominantRedText();

  // Step 8: Submit
  await dialog.submit();

  // Step 9: Verify success
  await vacationsPage.findNotification(data.notificationText);
  await vacationsPage.waitForVacationRow(data.periodPattern);

  // Step 9: Verify type = Administrative
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

  // Verify status = New
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

  // Step 11: Verify available vacation days did NOT decrease
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(daysAfter).toBeGreaterThanOrEqual(daysBefore);

  // Cleanup: delete the created vacation
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
