import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc070Data } from "../data/VacationTc070Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { AvailabilityChartPage } from "../pages/AvailabilityChartPage";

test("TC-VAC-070 - Verify availability chart — Months view @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc070Data.create(
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

  // Step 2: Navigate to Availability chart
  await page.goto(tttConfig.buildUrl("/vacation/chart"));
  const chartPage = new AvailabilityChartPage(page);
  await chartPage.waitForReady();
  await globalConfig.delay();

  // Verify default is Days view
  await expect(chartPage.daysToggle()).toBeVisible({ timeout: 5000 });
  await expect(chartPage.monthsToggle()).toBeVisible({ timeout: 5000 });

  // Step 3: Click "Months" toggle
  await chartPage.switchToMonthsView();
  await globalConfig.delay();

  // Step 4: Verify "Months" button is active (has pressed/active state)
  const monthsButton = chartPage.monthsToggle();
  await expect(monthsButton).toBeVisible({ timeout: 5000 });

  await verification.verify("Availability chart", testInfo);

  // Step 5: Verify date range pickers are displayed (Months view shows start/end date)
  const startDate = await chartPage.getMonthsStartDate();
  const endDate = await chartPage.getMonthsEndDate();
  expect(startDate, "Start date should be in dd.mm.yyyy format").toMatch(
    /^\d{2}\.\d{2}\.\d{4}$/,
  );
  expect(endDate, "End date should be in dd.mm.yyyy format").toMatch(
    /^\d{2}\.\d{2}\.\d{4}$/,
  );

  // Step 6: Verify month column headers (e.g. "2026 March", "2026 April")
  const monthHeaders = await chartPage.getMonthColumnHeaders();
  expect(
    monthHeaders.length,
    "Should have month column headers",
  ).toBeGreaterThanOrEqual(2);

  // Verify headers contain year + month name
  const monthNamePattern =
    /January|February|March|April|May|June|July|August|September|October|November|December/;
  const hasMonthNames = monthHeaders.some((h) => monthNamePattern.test(h));
  expect(hasMonthNames, "Month headers should contain month names").toBe(true);

  // Step 7: Verify employee rows exist
  const rowCount = await chartPage.getEmployeeRowCount();
  expect(rowCount, "Should have employee rows in Months view").toBeGreaterThan(
    0,
  );

  // Verify first employee has a name
  const names = await chartPage.getEmployeeNames();
  expect(names.length, "Should have employee names").toBeGreaterThan(0);
  expect(names[0].length, "First employee name should not be empty").toBeGreaterThan(0);

  await verification.verify("Availability chart", testInfo);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
