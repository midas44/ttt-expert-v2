import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc069Data } from "../data/VacationTc069Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { AvailabilityChartPage } from "../pages/AvailabilityChartPage";

test("TC-VAC-069 - Verify availability chart — Days view @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc069Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // Step 1: Login as department manager (can see subordinates on chart)
  const login = new LoginFixture(page, tttConfig, data.employeeLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Availability chart
  await page.goto(tttConfig.buildUrl("/vacation/chart"));
  const chartPage = new AvailabilityChartPage(page);
  await chartPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Verify page title
  await expect(chartPage.titleLocator()).toBeVisible({ timeout: 10000 });

  await verification.verify("Availability chart", testInfo);

  // Step 4: Verify "Days" and "Months" toggles visible
  await expect(chartPage.daysToggle()).toBeVisible({ timeout: 5000 });
  await expect(chartPage.monthsToggle()).toBeVisible({ timeout: 5000 });

  // Step 5: Verify employee rows exist in the chart
  // Note: table elements are in DOM but CSS-hidden due to overflow container.
  // Use evaluate() to read content from the DOM directly.
  const rowCount = await page.locator("table tbody tr").count();
  expect(rowCount, "Should have at least one employee row").toBeGreaterThan(0);

  // Verify first employee has a name
  const firstName = await page.locator("table tbody tr td:first-child").first()
    .evaluate((el) => el.textContent?.trim() ?? "");
  expect(firstName.length, "First employee should have a name").toBeGreaterThan(0);

  // Step 6: Verify day column headers with date and day-of-week
  const headers = page.locator("table thead th");
  const headerCount = await headers.count();
  expect(headerCount, "Should have column headers").toBeGreaterThan(5);

  // Collect header texts via evaluate (elements are CSS-hidden)
  const headerTexts: string[] = await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll("table thead th"));
    return ths.map((th) => th.textContent?.trim() ?? "").filter((t) => t.length > 0);
  });

  // Verify day headers contain day numbers with day-of-week (e.g. "23\nmo")
  const dayPattern = /\d+\s*(mo|tu|we|th|fr|sa|su)/i;
  const dayHeadersFound = headerTexts.filter((t) => dayPattern.test(t));
  expect(
    dayHeadersFound.length,
    "Should have day headers with day-of-week abbreviations",
  ).toBeGreaterThan(5);

  // Step 7: Verify weekend columns (sa, su) exist
  const hasWeekend = dayHeadersFound.some(
    (t) => /sa/i.test(t) || /su/i.test(t),
  );
  expect(hasWeekend, "Should have weekend columns (sa/su)").toBe(true);

  // Step 8: Verify month name headers exist
  const monthPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)$/;
  const monthHeaders = headerTexts.filter((t) => monthPattern.test(t));
  expect(monthHeaders.length, "Should show month name headers").toBeGreaterThanOrEqual(1);

  // Step 9: Verify table rows have cells
  // The chart may use split tables (name column + grid), so count all td across all tables
  const totalCells = await page.evaluate(() => {
    const rows = document.querySelectorAll("table tbody tr");
    if (rows.length === 0) return 0;
    let max = 0;
    rows.forEach((r) => {
      const c = r.querySelectorAll("td").length;
      if (c > max) max = c;
    });
    return max;
  });
  expect(totalCells, "Rows should have cells").toBeGreaterThan(0);

  await verification.verify("Availability chart", testInfo);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
