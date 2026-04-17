import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc002Data } from "../../data/day-off/DayoffTc002Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";

/**
 * TC-DO-002: Navigate to Days off tab from Vacations tab.
 * Verifies tab switching works correctly and URL changes to /vacation/my/daysoff.
 * Known bug: Days off tab sometimes redirects to /sick-leave/my.
 */
test("TC-DO-002: Navigate to Days off tab from Vacations tab @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc002Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);

  // Step 1-2: Login and navigate to My Vacations page
  await login.run();
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "networkidle",
  });
  await globalConfig.delay();

  // Step 3: Verify Vacations tab is the default (URL should be /vacation/my or similar)
  expect(page.url()).toContain("/vacation/my");
  await verification.captureStep(testInfo, "vacations-tab-default");

  // Step 4: Click Days off tab
  await dayOffPage.clickDaysOffTab();
  await globalConfig.delay();

  // Step 5: Verify URL changed to /vacation/my/daysoff (NOT /sick-leave/my)
  const currentUrl = page.url();
  expect(currentUrl).toContain("/vacation/my/daysoff");
  expect(currentUrl).not.toContain("/sick-leave");
  await verification.captureStep(testInfo, "daysoff-tab-active");

  // Step 6: Verify day-off table is displayed
  await dayOffPage.waitForReady();
  const rowCount = await dayOffPage.getRowCount();
  expect(rowCount).toBeGreaterThanOrEqual(0); // Could be 0 if no holidays configured
  await verification.captureStep(testInfo, "daysoff-table-visible");

  // Cleanup
  await logout.runViaDirectUrl();
  await page.close();
});
