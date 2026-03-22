import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc072Data } from "../data/VacationTc072Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { AvailabilityChartPage } from "../pages/AvailabilityChartPage";

test("TC-VAC-072 - Verify chart timeline navigation @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc072Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // Step 1: Login
  const login = new LoginFixture(page, tttConfig, data.employeeLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Availability chart (Days view by default)
  await page.goto(tttConfig.buildUrl("/vacation/chart"));
  const chartPage = new AvailabilityChartPage(page);
  await chartPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Read current month text
  const initialMonth = await chartPage.getMonthYearText();
  expect(initialMonth, "Should display month/year text").toMatch(
    /^[A-Z][a-z]{2}\s\d{4}$/,
  );

  await verification.verify("Availability chart", testInfo);

  // Step 4: Click next month arrow
  await chartPage.clickNextMonth();
  await page.waitForTimeout(1500); // Wait for chart to re-render

  // Step 5: Verify month changed forward
  const nextMonth = await chartPage.getMonthYearText();
  expect(nextMonth, "Month should have changed after clicking next").not.toBe(
    initialMonth,
  );

  // Verify the day column headers updated (new month's days should appear)
  const headerTexts: string[] = await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll("table thead th"));
    return ths
      .map((th) => th.textContent?.trim() ?? "")
      .filter((t) => t.length > 0);
  });
  expect(
    headerTexts.length,
    "Should still have column headers after navigation",
  ).toBeGreaterThan(5);

  await verification.verify("Availability chart", testInfo);

  // Step 6: Click previous month arrow
  await chartPage.clickPrevMonth();
  await page.waitForTimeout(1500);

  // Step 7: Verify month returned to original
  const restoredMonth = await chartPage.getMonthYearText();
  expect(
    restoredMonth,
    "Clicking prev should return to original month",
  ).toBe(initialMonth);

  // Step 8: Verify employee rows still displayed after navigation
  const rowCount = await chartPage.getEmployeeRowCount();
  expect(
    rowCount,
    "Should still have employee rows after navigation",
  ).toBeGreaterThan(0);

  await verification.verify("Availability chart", testInfo);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
