import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc054Data } from "../../data/vacation/VacationTc054Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { AvailabilityChartPage } from "@ttt/pages/AvailabilityChartPage";

/**
 * TC-VAC-054: Availability chart — vacation display.
 * SETUP: Creates and approves a vacation via API.
 * Test: navigates to the availability chart, searches for the employee,
 * navigates to the vacation month, and verifies colored cells appear.
 */
test("TC-VAC-054: Availability chart — vacation display @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc054Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create and approve a vacation via API
  const vacation = await setup.createAndApprove(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    // Step 1-2: Login, ensure English
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 3: Navigate to Availability chart
    await page.goto(`${tttConfig.appUrl}/vacation/chart`, {
      waitUntil: "domcontentloaded",
    });
    const chartPage = new AvailabilityChartPage(page);
    await chartPage.waitForReady();
    await globalConfig.delay();

    // Step 4: Ensure Days view is active
    await chartPage.daysToggle().click();
    await globalConfig.delay();

    // Step 5: Navigate to the vacation's month
    const startYear = parseInt(data.startDateIso.split("-")[0], 10);
    await chartPage.navigateToMonth(startYear, data.startMonth);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "chart-month-navigated");

    // Step 6: Search for the employee
    await chartPage.searchBox().fill(data.displayName);
    await globalConfig.delay();
    // Wait for table to filter
    await page.waitForTimeout(1000);

    // Step 7: Verify employee row is visible in the chart
    const employeeRow = chartPage.employeeRow(data.displayName);
    await expect(employeeRow.first()).toBeAttached();

    // Step 8: Verify colored cells exist for the vacation dates
    const coloredCells = await chartPage.getColoredCellCount(data.displayName);
    expect(
      coloredCells,
      "Expected colored cells in the chart for the APPROVED vacation dates",
    ).toBeGreaterThanOrEqual(1);
    await verification.captureStep(testInfo, "chart-vacation-visible");

    // Step 9: Verify Days/Months toggle buttons are present
    await expect(chartPage.daysToggle()).toBeVisible();
    await expect(chartPage.monthsToggle()).toBeVisible();
  } finally {
    // CLEANUP: Cancel and delete the vacation
    await setup.cancelVacation(vacation.id);
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
