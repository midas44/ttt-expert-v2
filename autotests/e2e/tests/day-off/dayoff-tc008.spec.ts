import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc008Data } from "../../data/day-off/DayoffTc008Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";

/**
 * TC-DO-008: Verify holidays per salary office — Cyprus.
 *
 * Logs in as a Cyprus-calendar employee, navigates to the Days off tab,
 * and verifies the holiday count matches the production calendar.
 * Cyprus should have fewer holidays than Russia.
 */
test("TC-DO-008: Verify holidays per salary office — Cyprus @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc008Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.username,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);

  try {
    // Step 1: Login as Cyprus-office employee
    await login.run();

    // Step 2: Navigate to Days off tab
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Count the number of public holidays displayed
    const rowCount = await dayOffPage.getRowCount();
    await verification.captureStep(testInfo, "cyprus-holidays-table");

    // Step 4: Verify row count matches expected (from production calendar)
    expect(
      rowCount,
      `Expected ${data.expectedHolidayCount} Cyprus holidays, got ${rowCount}`,
    ).toBe(data.expectedHolidayCount);

    // Step 5: Verify fewer than Russia's typical count (~18 including shortened days)
    expect(
      rowCount,
      "Cyprus should have fewer calendar entries than Russia (~18)",
    ).toBeLessThan(18);
    await verification.captureStep(testInfo, "cyprus-count-less-than-russia");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
