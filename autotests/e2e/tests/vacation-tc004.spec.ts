import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc004Data } from "../data/VacationTc004Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { DbClient } from "../config/db/dbClient";
import { countVacationNotifyAlso } from "../data/queries/vacationQueries";

test("TC-VAC-004 - Create vacation with Also notify colleagues @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc004Data.create(
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

  // Step 3: Click "Create a request"
  const dialog = await vacationsPage.openCreateRequest();

  // Step 4: Fill dates
  await dialog.fillVacationPeriod(data.startDate, data.endDate);

  // Step 5-6: Fill "Also notify" with colleague
  await dialog.fillAlsoNotify(data.colleagueLogin, data.colleagueName);
  await dialog.assertNotifySelected(data.colleagueName);

  // Step 7: Verify no red error text
  await dialog.assertNoDominantRedText();

  // Step 8: Submit
  await dialog.submit();

  // Step 9: Verify success notification
  const notification = await vacationsPage.findNotification(
    data.notificationText,
  );
  await verification.verifyLocatorDominantGreen(
    notification,
    testInfo,
    "success-notification",
  );

  // Step 10: Verify row appears
  await vacationsPage.waitForVacationRow(data.periodPattern);
  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    data.expectedStatus,
    testInfo,
    "status-new",
  );

  // DB-CHECK: Verify vacation_notify_also entries
  const db = new DbClient(tttConfig);
  try {
    const notifyCount = await countVacationNotifyAlso(
      db,
      data.username,
      data.startDateIso(),
      data.endDateIso(),
    );
    expect(notifyCount).toBeGreaterThanOrEqual(1);
  } finally {
    await db.close();
  }

  // Cleanup: delete the created vacation
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
