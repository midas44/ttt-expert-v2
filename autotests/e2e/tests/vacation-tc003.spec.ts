import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc003Data } from "../data/VacationTc003Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-003 - Create vacation with comment @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc003Data.create(
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

  // Step 3: Create vacation with comment
  const dialog = await vacationsPage.openCreateRequest();
  await dialog.fillVacationPeriod(data.startDate, data.endDate);

  // Step 5: Enter comment
  await dialog.fillComment(data.comment);
  await dialog.assertNoDominantRedText();

  // Step 6: Submit
  await dialog.submit();

  // Step 7: Verify success
  await vacationsPage.findNotification(data.notificationText);
  await vacationsPage.waitForVacationRow(data.periodPattern);

  // Verify status
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

  // Step 8-9: Open request details and verify comment is visible
  await globalConfig.delay();
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await expect(detailsDialog.root()).toContainText(data.comment);
  await verification.verifyLocatorVisible(
    detailsDialog.root(),
    testInfo,
    "details-dialog-with-comment",
  );

  // Close details dialog
  await detailsDialog.close();

  // Cleanup: delete the created vacation
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
