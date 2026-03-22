import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc028Data } from "../data/VacationTc028Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-028 - Verify days returned to balance after cancel @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc028Data.create(
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
  const vacationCreation = new VacationCreationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Navigate to My vacations
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Note available days before creation (X)
  const daysBefore = await vacationsPage.getAvailableDays();

  // Step: Create a 5-day NEW vacation
  await vacationCreation.createVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });
  await globalConfig.delay();

  // Verify days decreased after creation
  const daysAfterCreate = await vacationsPage.getAvailableDays();
  expect(daysAfterCreate).toBeLessThan(daysBefore);

  // Step 4: Cancel the NEW vacation via Request Details → Delete
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await globalConfig.delay();

  // Step 5-6: Verify available days returned to original value
  const daysAfterCancel = await vacationsPage.getAvailableDays();
  expect(daysAfterCancel).toBe(daysBefore);

  // Take verification screenshot
  await verification.verifyLocatorVisible(
    vacationsPage.titleLocator(),
    testInfo,
    "days-restored-after-cancel",
  );

  // Logout
  await logout.runViaDirectUrl();
  await page.close();
});
