import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc061Data } from "../data/VacationTc061Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-061 - Verify day recalculation after cancel @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc061Data.create(
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
  const vacationsPage = new MyVacationsPage(page);
  const vacationCreation = new VacationCreationFixture(page, globalConfig);
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

  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Note available days BEFORE creation
  await page.locator("text=/Available vacation days/").waitFor({ state: "visible" });
  await globalConfig.delay();
  const daysBefore = await vacationsPage.getAvailableDays();

  // Create a 5-day regular vacation
  await vacationCreation.createVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });
  await globalConfig.delay();

  // Note days AFTER creation — should be less
  const daysAfterCreate = await vacationsPage.getAvailableDays();
  expect(
    daysAfterCreate,
    "Days should decrease after creating regular vacation",
  ).toBeLessThan(daysBefore);

  const daysConsumed = daysBefore - daysAfterCreate;

  // === Cancel the vacation via details dialog → delete ===
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });
  await globalConfig.delay();

  // Refresh page to get updated available days
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Verify days restored
  const daysAfterCancel = await vacationsPage.getAvailableDays();
  expect(
    daysAfterCancel,
    "Days should be restored after cancellation/deletion",
  ).toBe(daysBefore);

  const verification = new VerificationFixture(page, globalConfig);
  await verification.verify("My vacations and days off", testInfo);

  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
