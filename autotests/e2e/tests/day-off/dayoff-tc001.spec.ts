import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc001Data } from "../../data/day-off/DayoffTc001Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";

/**
 * TC-DO-001: View day-off list for current year.
 * Verifies the Days off tab displays public holidays for the employee's salary office.
 */
test("TC-DO-001: View day-off list for current year @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc001Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);

  // Step 1-2: Login and navigate to Days off tab
  await login.run();
  await dayOffPage.goto(tttConfig.appUrl);
  await dayOffPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Verify table has expected columns (6: Date, Duration, Reason, Approver, Status, Actions)
  const headers = await dayOffPage.getHeaderTexts();
  const nonEmptyHeaders = headers.filter((h) => h.trim().length > 0);
  expect(nonEmptyHeaders.length).toBeGreaterThanOrEqual(5);
  await verification.captureStep(testInfo, "dayoff-table-columns");

  // Step 4: Verify rows are present (at least 1 holiday)
  const rowCount = await dayOffPage.getRowCount();
  expect(rowCount).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "dayoff-rows-present");

  // Cleanup
  await logout.runViaDirectUrl();
  await page.close();
});
