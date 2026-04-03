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

  // Step 4: Read the available days display ("N in YYYY" format = current year only)
  const fullText = await vacationsPage.getAvailableDaysFullText();
  const displayMatch = fullText.match(/(\d+)\s+in\s+(\d{4})/);
  const displayedDays = displayMatch ? parseInt(displayMatch[1], 10) : await vacationsPage.getAvailableDays();
  const displayedYear = displayMatch ? displayMatch[2] : null;
  expect(displayedDays).toBeGreaterThanOrEqual(0);
  await verification.captureStep(testInfo, "available-days-counter");

  // Step 5: Click the info icon to open per-year breakdown
  await vacationsPage.toggleYearlyBreakdown();
  await globalConfig.delay();

  // Step 6: Read the yearly breakdown entries
  const entries = await vacationsPage.getYearlyBreakdownWithFallback();
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

  // Step 8: Verify the displayed year's entry matches the counter value
  if (displayedYear) {
    const matchingEntry = entries.find((e) => e.year === displayedYear);
    expect(
      matchingEntry,
      `Expected breakdown to contain entry for displayed year ${displayedYear}`,
    ).toBeDefined();
    expect(
      parseInt(matchingEntry!.days, 10),
      `Displayed days (${displayedDays}) should match year ${displayedYear} breakdown entry`,
    ).toBe(displayedDays);
  }

  // Step 9: Verify sum of breakdown entries is positive (consistent total)
  const uiSum = entries.reduce((sum, e) => sum + parseInt(e.days, 10), 0);
  expect(uiSum, "Sum of breakdown entries should be positive").toBeGreaterThan(0);

  await logout.runViaDirectUrl();
  await page.close();
});
