import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc018Data } from "../data/VacationTc018Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-018 - CPO creates vacation — self-approval @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc018Data.create(
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

  // Step 1: Login as CPO employee
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

  // Step 5: Verify "Approved by" shows the CPO themselves (self-approval)
  const approvedBy = await dialog.getApprovedByText();
  expect(
    approvedBy.length > 0,
    "Approved by field should show the CPO's own name (self-approval)",
  ).toBeTruthy();
  // The CPO's name should appear in the approved by field
  // Check if it contains part of the employee name
  const empNameParts = data.employeeName.split(" ");
  const approvedBySelf = empNameParts.some((part) =>
    approvedBy.toLowerCase().includes(part.toLowerCase()),
  );
  expect(
    approvedBySelf,
    `Approved by should contain CPO name "${data.employeeName}", got: "${approvedBy}"`,
  ).toBeTruthy();

  // Step 6: Verify "Agreed by" shows the CPO's manager (as optional approver)
  const agreedBy = await dialog.getAgreedByText();
  if (agreedBy.length > 0) {
    // Manager name should appear in the agreed by field
    const mgrNameParts = data.managerName.split(" ");
    const agreedByManager = mgrNameParts.some((part) =>
      agreedBy.toLowerCase().includes(part.toLowerCase()),
    );
    expect(
      agreedByManager,
      `Agreed by should contain manager name "${data.managerName}", got: "${agreedBy}"`,
    ).toBeTruthy();
  }

  await verification.verifyLocatorVisible(
    dialog.root(),
    testInfo,
    "cpo-self-approval-dialog",
  );

  // Step 7: Save
  await dialog.submit();

  // Step 8: Verify vacation created with status "New"
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  await expect(row).toHaveCount(1);
  await globalConfig.delay();

  const statusCell = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusCell,
    "New",
    testInfo,
    "cpo-vacation-status-new",
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
