import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc011Data } from "../../data/vacation/VacationTc011Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-011: Available days counter — per-year breakdown tooltip.
 * Verifies the info popup shows individual year balances that sum to the total.
 */
test("TC-VAC-011: Available days counter — per-year breakdown tooltip @regress @vacation", async ({
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
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1-2: Login, switch to English
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 3: Navigate to My Vacations
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  const vacationsPage = new MyVacationsPage(page);
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Step 4: Read the available days total
  const totalText = await vacationsPage.getAvailableDaysFullText();
  expect(totalText.length).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "available-days-counter");

  // Step 5: Click the info icon to open per-year breakdown
  await vacationsPage.toggleYearlyBreakdown();
  await globalConfig.delay();

  // Step 6: Read the yearly breakdown entries
  const entries = await vacationsPage.getYearlyBreakdownEntries();
  expect(
    entries.length,
    "Expected at least 2 years in breakdown",
  ).toBeGreaterThanOrEqual(2);
  await verification.captureStep(testInfo, "yearly-breakdown-open");

  // Step 7: Verify each entry has a valid year and days count
  for (const entry of entries) {
    expect(parseInt(entry.year, 10)).toBeGreaterThanOrEqual(2020);
    expect(parseInt(entry.days, 10)).toBeGreaterThanOrEqual(0);
  }

  // Step 8: Verify sum of all years matches the displayed total
  const uiSum = entries.reduce((sum, e) => sum + parseInt(e.days, 10), 0);
  const displayedTotal = parseInt(totalText.replace(/\D/g, ""), 10);
  expect(
    uiSum,
    `UI yearly sum (${uiSum}) should match displayed total (${displayedTotal})`,
  ).toBe(displayedTotal);

  await logout.runViaDirectUrl();
  await page.close();
});
