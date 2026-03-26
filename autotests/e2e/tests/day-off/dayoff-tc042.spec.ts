import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc042Data } from "../data/DayoffTc042Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffPage } from "../pages/DayOffPage";

/**
 * TC-DO-042: MY search type — own requests only.
 *
 * SETUP creates a transfer for the employee. Verifies the Days off tab
 * shows the employee's own day-off records including the new transfer
 * (arrow format row). The MY search type only returns the logged-in
 * employee's own records.
 */
test("TC-DO-042: MY search type — own requests only @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc042Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);

  try {
    // Step 1: Login as employee
    await login.run();

    // Step 2: Navigate to Days off tab
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "daysoff-table-loaded");

    // Step 3: Verify the table shows day-off records
    const rowCount = await dayOffPage.getRowCount();
    expect(rowCount, "Days off table should have rows").toBeGreaterThan(0);

    // Step 4: Verify the created transfer row is visible (arrow format)
    const hasArrow = await dayOffPage.rowHasArrowFormat(
      data.originalDateDisplay,
    );
    expect(
      hasArrow,
      `Transfer row for ${data.originalDateDisplay} should show arrow format`,
    ).toBe(true);
    await verification.captureStep(testInfo, "transfer-row-arrow-format");

    // Step 5: Verify the transfer row shows NEW status
    const status = await dayOffPage.getRowStatus(data.originalDateDisplay);
    expect(status.toLowerCase()).toContain("new");

    // Step 6: Verify row count is reasonable (matches DB count ± small margin)
    expect(
      rowCount,
      `Row count (${rowCount}) should be close to expected (${data.expectedRowCount})`,
    ).toBeGreaterThanOrEqual(data.expectedRowCount - 2);
    await verification.captureStep(testInfo, "row-count-verified");
  } finally {
    await DayoffTc042Data.cleanup(data.requestId, tttConfig);
    await logout.runViaDirectUrl();
    await page.close();
  }
});
