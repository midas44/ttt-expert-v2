import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T3404Tc006Data } from "../../data/t3404/T3404Tc006Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";

/**
 * TC-T3404-008: Edit icon hidden for last day of closed month.
 * Boundary: the last actionable day of a closed month (e.g., Feb 23) should
 * NOT show an edit icon since the entire month is before the approve period.
 * Reuses TC-006 data class (closed period day-off).
 */
test("TC-T3404-008: Edit icon hidden last day closed month @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc006Data.create(
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
  await verification.captureStep(testInfo, "dayoff-tab-loaded");

  // Step 3: Find the closed-period day-off row
  const row = dayOffPage.dayOffRow(data.dateDisplay);
  await expect(row.first()).toBeVisible({ timeout: globalConfig.stepTimeoutMs });
  await verification.captureStep(testInfo, "closed-month-row-found");

  // Step 4: Verify edit icon is NOT visible (closed approve period boundary)
  const hasEdit = await dayOffPage.hasEditButton(data.dateDisplay);
  expect(hasEdit).toBe(false);
  await verification.captureStep(testInfo, "edit-icon-hidden-last-closed-day");

  // Cleanup
  await logout.runViaDirectUrl();
  await page.close();
});
