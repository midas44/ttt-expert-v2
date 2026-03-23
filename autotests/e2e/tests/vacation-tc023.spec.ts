import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc023Data } from "../data/VacationTc023Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-023 - Restore CANCELED vacation (re-open) @regress", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc023Data.create(
    globalConfig.testDataMode,
    tttConfig,
    request,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const vacationDeletion = new VacationDeletionFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login as the vacation owner
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations → "Closed" tab
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();

  // Step 3: Locate the CANCELED vacation
  await vacationsPage.waitForVacationRow(data.periodPattern);
  const statusBefore = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  const statusBeforeText = await statusBefore.textContent();
  expect(
    statusBeforeText?.includes("Canceled"),
    `Expected Canceled status, got: ${statusBeforeText}`,
  ).toBeTruthy();

  // Step 4: Click edit (pencil icon) to restore the vacation
  const editDialog = await vacationsPage.openEditDialog(data.periodPattern);

  // Step 5: Verify edit dialog opens with dates
  await expect(editDialog.root()).toBeVisible();

  // Step 6: Click "Save" without changes to restore
  await editDialog.submit();
  await globalConfig.delay();

  // Step 7: The vacation should now move from Closed to Open tab
  // Switch to Open tab
  await vacationsPage.clickOpenTab();
  await globalConfig.delay();

  // Verify the vacation is now in Open tab with status "New"
  await vacationsPage.waitForVacationRow(data.periodPattern);
  const statusAfter = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusAfter,
    "New",
    testInfo,
    "restored-vacation-status-new",
  );

  // Step 8: Verify on the "All" tab for completeness
  await vacationsPage.clickAllTab();
  await globalConfig.delay();
  await vacationsPage.waitForVacationRow(data.periodPattern);

  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(data.periodPattern).first(),
    testInfo,
    "restored-vacation-in-all-tab",
  );

  // Cleanup: delete the restored vacation to return to original state
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
