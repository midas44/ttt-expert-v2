import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc006Data } from "../../data/day-off/DayoffTc006Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";

/**
 * TC-DO-006: Year selector changes displayed holidays.
 *
 * Switches the year selector between current and previous year,
 * verifying the table reloads with different data each time.
 */
test("TC-DO-006: Year selector changes displayed holidays @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc006Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);

  try {
    // Step 1-2: Login and navigate to Days off tab
    await login.run();
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Note row count for current year
    const currentYearRows = await dayOffPage.getRowCount();
    expect(currentYearRows).toBeGreaterThan(0);
    await verification.captureStep(testInfo, "current-year-rows");

    // Step 4-5: Select previous year
    await dayOffPage.selectYear(data.previousYear);
    await globalConfig.delay();
    await dayOffPage.waitForReady();

    // Step 6: Verify table loaded with previous year data
    const prevYearRows = await dayOffPage.getRowCount();
    expect(prevYearRows).toBeGreaterThan(0);
    await verification.captureStep(testInfo, "previous-year-rows");

    // Step 7: Select current year again and verify data returns
    await dayOffPage.selectYear(data.currentYear);
    await globalConfig.delay();
    await dayOffPage.waitForReady();

    const restoredRows = await dayOffPage.getRowCount();
    expect(restoredRows).toBeGreaterThan(0);
    // Row count should match original (same year, same data)
    expect(restoredRows).toBe(currentYearRows);
    await verification.captureStep(testInfo, "current-year-restored");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
