import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc016Data } from "../data/VacationTc016Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { VacationCreateDialog } from "../pages/VacationCreateDialog";

test("TC-VAC-016 - Verify Number of days auto-calculation in dialog @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc016Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Step 4: Set Monday to Friday (5 working days)
  await dialog.fillVacationPeriod(data.mondayDate, data.fridayDate);
  await globalConfig.delay();

  // Step 5: Verify "Number of days" shows 5 (or 4 if a public holiday in range)
  const daysMonFri = await dialog.getNumberOfDays();
  const daysMonFriNum = parseInt(daysMonFri, 10);
  expect(
    daysMonFriNum >= 4 && daysMonFriNum <= 5,
    `Mon-Fri should show 4-5 days, got: ${daysMonFri}`,
  ).toBeTruthy();

  // Step 6: Change end date to Saturday — days should still be ~5 (Saturday excluded)
  await dialog.fillVacationPeriod(data.mondayDate, data.saturdayDate);
  await globalConfig.delay();
  const daysMonSat = await dialog.getNumberOfDays();
  const daysMonSatNum = parseInt(daysMonSat, 10);
  expect(
    daysMonSatNum >= 4 && daysMonSatNum <= 5,
    `Mon-Sat should show 4-5 days (Sat excluded), got: ${daysMonSat}`,
  ).toBeTruthy();

  // Step 7: Set Saturday to Sunday only — should show 0 days
  await dialog.fillVacationPeriod(data.saturdayDate, data.sundayDate);
  await globalConfig.delay();
  const daysSatSun = await dialog.getNumberOfDays();
  const daysSatSunNum = parseInt(daysSatSun, 10);
  expect(
    daysSatSunNum === 0,
    `Sat-Sun should show 0 days, got: ${daysSatSun}`,
  ).toBeTruthy();

  await verification.verifyLocatorVisible(
    dialog.root(),
    testInfo,
    "days-calculation-verified",
  );

  // Close dialog without saving
  await dialog.cancel();

  await logout.runViaDirectUrl();
  await page.close();
});
