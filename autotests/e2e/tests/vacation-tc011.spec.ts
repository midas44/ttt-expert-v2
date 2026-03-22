import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc011Data } from "../data/VacationTc011Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-011 - Verify available vacation days display and yearly breakdown @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc011Data.create(
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
  await globalConfig.delay();

  // Step 3: Verify available vacation days displayed (may be "N in YYYY" or just "N")
  const daysText = await vacationsPage.getAvailableDaysFullText();
  expect(daysText).toMatch(/\d+/);

  // Parse the displayed number — handle both "N in YYYY" and "N" formats
  const fullMatch = daysText.match(/(\d+)\s+in\s+(\d{4})/);
  const displayedDays = fullMatch
    ? parseInt(fullMatch[1], 10)
    : parseInt(daysText, 10);
  const displayedYear = fullMatch
    ? fullMatch[2]
    : new Date().getFullYear().toString();
  expect(displayedDays).toBeGreaterThanOrEqual(0);

  await verification.verifyLocatorVisible(
    page.locator("text=/Available vacation days/"),
    testInfo,
    "available-days-visible",
  );

  // Step 4: Click the info/expand icon to open yearly breakdown
  await vacationsPage.toggleYearlyBreakdown();
  await globalConfig.delay();

  // Step 5: Verify popup shows per-year breakdown
  const entries = await vacationsPage.getYearlyBreakdownEntries();
  expect(entries.length).toBeGreaterThanOrEqual(2);

  // Verify that the displayed year appears in the breakdown
  const displayedYearEntry = entries.find((e) => e.year === displayedYear);
  expect(displayedYearEntry).toBeDefined();

  // Verify each entry has reasonable values
  for (const entry of entries) {
    expect(parseInt(entry.days, 10)).toBeGreaterThanOrEqual(0);
    expect(entry.year).toMatch(/^\d{4}$/);
  }

  // Step 6: Verify total matches main display
  const totalFromBreakdown = entries.reduce(
    (sum, e) => sum + parseInt(e.days, 10),
    0,
  );
  expect(totalFromBreakdown).toBe(displayedDays);

  await verification.verifyLocatorVisible(
    page.locator("text=/Available vacation days/"),
    testInfo,
    "yearly-breakdown-verified",
  );

  // Step 7: Close popup by clicking toggle again
  await vacationsPage.toggleYearlyBreakdown();

  await logout.runViaDirectUrl();
  await page.close();
});
