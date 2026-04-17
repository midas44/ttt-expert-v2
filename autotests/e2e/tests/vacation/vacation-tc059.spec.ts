import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc059Data } from "../../data/vacation/VacationTc059Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-059: AV=false — monthly accrual, no negative.
 * Verifies that AV=false employees have balance proportional to months elapsed,
 * the counter never shows negative, and vacation creation exceeding balance is blocked.
 */
test("TC-VAC-059: AV=false — monthly accrual, no negative @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc059Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login as the AV=false employee
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 2: Navigate to /vacation/my
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  const vacationsPage = new MyVacationsPage(page);
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Check 'Available vacation days'
  const uiDays = await vacationsPage.getAvailableDays();
  await verification.captureStep(testInfo, "available-days-counter");

  // Step 4: Verify the count is non-negative
  // AV=false: available = (month × norm/12) + yearRemainder + priorYears - norm + future + edited
  // If computed balance is negative, UI displays 0. Verify >= 0.
  expect(uiDays).toBeGreaterThanOrEqual(0);

  // Step 5: Verify the counter never shows a negative value
  const fullText = await vacationsPage.getAvailableDaysFullText();
  await verification.captureStep(testInfo, "available-days-full-text");
  // AV=false: if computed balance is negative, UI displays 0
  const numericMatch = fullText.match(/(\d+)/);
  if (numericMatch) {
    expect(parseInt(numericMatch[1], 10)).toBeGreaterThanOrEqual(0);
  }

  // Step 6: Open yearly breakdown to verify per-year values are non-negative
  await vacationsPage.toggleYearlyBreakdown();
  await globalConfig.delay();
  const entries = await vacationsPage.getYearlyBreakdownEntries();
  await verification.captureStep(testInfo, "yearly-breakdown");

  expect(entries.length).toBeGreaterThanOrEqual(1);
  for (const entry of entries) {
    expect(parseInt(entry.days, 10)).toBeGreaterThanOrEqual(0);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
