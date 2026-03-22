import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc006Data } from "../data/VacationTc006Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-006 - Edit vacation dates in NEW status @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc006Data.create(
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

  // Cleanup: remove leftovers from previous runs
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.createStartDate,
    endInput: data.createEndDate,
    periodPattern: data.createPeriodPattern,
  });
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.editStartDate,
    endInput: data.editEndDate,
    periodPattern: data.editPeriodPattern,
  });

  // Step 2: Create a NEW vacation first
  const createDialog = await vacationsPage.openCreateRequest();
  await createDialog.fillVacationPeriod(data.createStartDate, data.createEndDate);
  await createDialog.assertNoDominantRedText();
  await createDialog.submit();
  await vacationsPage.findNotification(data.notificationText);
  await vacationsPage.waitForVacationRow(data.createPeriodPattern);
  await globalConfig.delay();

  // Verify initial status is NEW
  const initialStatus = await vacationsPage.columnCell(
    data.createPeriodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    initialStatus,
    data.expectedStatus,
    testInfo,
    "initial-status-new",
  );

  // Step 3: Click edit (pencil icon) on the NEW vacation row
  const editDialog = await vacationsPage.openEditDialog(data.createPeriodPattern);

  // Step 5-6: Change dates to a different Mon–Fri period
  await editDialog.fillVacationPeriod(data.editStartDate, data.editEndDate);

  // Step 8: Click Save
  await editDialog.submit();
  await globalConfig.delay();

  // Step 9: Verify vacation row updates with new dates
  await vacationsPage.waitForVacationRow(data.editPeriodPattern);

  // Step 10: Verify status remains "New"
  const statusCell = await vacationsPage.columnCell(
    data.editPeriodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    data.expectedStatus,
    testInfo,
    "status-still-new-after-edit",
  );

  // Verify old dates no longer visible
  const oldRowCount = await vacationsPage.vacationRow(data.createPeriodPattern).count();
  expect(oldRowCount).toBe(0);

  // Cleanup: delete the edited vacation
  await vacationDeletion.deleteVacation({
    startInput: data.editStartDate,
    endInput: data.editEndDate,
    periodPattern: data.editPeriodPattern,
  });

  // Logout
  await logout.runViaDirectUrl();
  await page.close();
});
