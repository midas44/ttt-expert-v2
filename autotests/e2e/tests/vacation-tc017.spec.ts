import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc017Data } from "../data/VacationTc017Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-017 - Create vacation with optional approvers @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc017Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.employeeLogin,
    globalConfig,
  );
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const vacationDeletion = new VacationDeletionFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login as the non-CPO employee
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations
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

  // Step 3: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Step 4: Fill valid dates
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await globalConfig.delay();

  // Step 5: Verify "Approved by" shows the direct manager
  const approvedBy = await dialog.getApprovedByText();
  expect(
    approvedBy.length > 0,
    "Approved by field should show the manager name",
  ).toBeTruthy();

  // Step 6: Note "Agreed by" section (may be empty for non-CPO employees)
  const agreedBy = await dialog.getAgreedByText();
  // agreedBy may be empty for regular employees — that's expected

  await verification.verifyLocatorVisible(
    dialog.root(),
    testInfo,
    "approver-fields-visible",
  );

  // Step 7: Save
  await dialog.submit();

  // Step 8: Verify vacation created
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  await expect(row).toHaveCount(1);
  await globalConfig.delay();

  // Step 9: Verify status is "New"
  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    "New",
    testInfo,
    "status-new-with-approver",
  );

  // Cleanup: delete the created vacation
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  await logout.runViaDirectUrl();
  await page.close();
});
