import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc007Data } from "../data/DayoffTc007Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffPage } from "../pages/DayOffPage";

/**
 * TC-DO-007: Verify holidays per salary office — Russia.
 *
 * Logs in as a Russian-calendar employee, navigates to the Days off tab,
 * and verifies the expected number of public holidays and that typical
 * Russian holiday names appear in the Reason column.
 */
test("TC-DO-007: Verify holidays per salary office — Russia @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc007Data.create(
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
    // Step 1: Login as Russian-office employee
    await login.run();

    // Step 2: Navigate to Days off tab
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Count the number of public holidays displayed
    const rowCount = await dayOffPage.getRowCount();
    await verification.captureStep(testInfo, "russian-holidays-table");

    // Step 4: Verify row count matches expected (from production calendar)
    expect(
      rowCount,
      `Expected ${data.expectedHolidayCount} Russian holidays, got ${rowCount}`,
    ).toBe(data.expectedHolidayCount);

    // Step 5: Verify typical Russian holiday names appear in the table.
    // Use the visible table's text content to avoid hidden dialog tables.
    const tableText =
      (await page
        .locator("table:visible tbody")
        .first()
        .textContent()) ?? "";
    let matchedCount = 0;
    const matchedNames: string[] = [];
    for (const pattern of data.expectedReasonPatterns) {
      if (pattern.test(tableText)) {
        matchedCount++;
        matchedNames.push(pattern.source);
      }
    }
    expect(
      matchedCount,
      `Expected >=5 of 7 Russian holiday patterns. Found: [${matchedNames.join(", ")}]. Table length=${tableText.length}`,
    ).toBeGreaterThanOrEqual(5);
    await verification.captureStep(testInfo, "russian-holiday-names-verified");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
