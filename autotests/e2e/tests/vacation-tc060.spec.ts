import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc060Data } from "../data/VacationTc060Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-060 - Verify administrative vacation does not deduct days @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc060Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const vacationDeletion = new VacationDeletionFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

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

  // Re-navigate to refresh available days
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Note available days BEFORE creation
  const daysBefore = await vacationsPage.getAvailableDays();

  // Create administrative (unpaid) vacation
  const dialog = await vacationsPage.openCreateRequest();
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await dialog.ensureUnpaidVacationChecked();
  await dialog.submit();

  // Wait for vacation row to appear
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  await expect(row).toHaveCount(1);
  await globalConfig.delay();

  // Verify available days unchanged
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(
    daysAfter,
    "Available days should NOT change for administrative vacation",
  ).toBe(daysBefore);

  // Verify vacation type is Administrative
  const verification = new VerificationFixture(page, globalConfig);
  const typeCell = await vacationsPage.columnCell(
    data.periodPattern,
    "type",
  );
  await verification.verifyLocatorText(
    typeCell,
    "Administrative",
    testInfo,
    "type-administrative",
  );

  // === Cleanup: delete the created vacation ===
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
