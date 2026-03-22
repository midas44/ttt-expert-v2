import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc010Data } from "../data/VacationTc010Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-010 - Verify Open/Closed/All filter tabs @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc010Data.create(
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

  // Step 2: Navigate to My vacations and days off
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3-4: Verify "Open" tab is active by default — vacations visible
  await globalConfig.delay();
  const openRows = await vacationsPage.getRowCount();
  expect(openRows).toBeGreaterThan(0);
  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(/.+/).first(),
    testInfo,
    "open-tab-has-rows",
  );

  // Step 5-6: Click "Closed" tab — verify closed vacations visible
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();
  const closedRows = await vacationsPage.getRowCount();
  expect(closedRows).toBeGreaterThan(0);
  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(/.+/).first(),
    testInfo,
    "closed-tab-has-rows",
  );

  // Step 7-8: Click "All" tab — verify all vacations visible
  await vacationsPage.clickAllTab();
  await globalConfig.delay();
  const allRows = await vacationsPage.getRowCount();
  expect(allRows).toBeGreaterThan(0);
  expect(allRows).toBeGreaterThanOrEqual(Math.max(openRows, closedRows));
  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(/.+/).first(),
    testInfo,
    "all-tab-has-rows",
  );

  await logout.runViaDirectUrl();
  await page.close();
});
