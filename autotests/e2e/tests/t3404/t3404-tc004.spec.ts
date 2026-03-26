import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T3404Tc004Data } from "../../data/t3404/T3404Tc004Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";

/**
 * TC-T3404-004: Edit icon visible for future day-off in open month (baseline).
 * This is a baseline/regression check — future day-offs in open approve period
 * should still show edit icon (this behavior existed before #3404).
 */
test("TC-T3404-004: Edit icon visible for future day-off in open month @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc004Data.create(
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

  // Step 3: Find the future day-off row in the open period
  const row = dayOffPage.dayOffRow(data.dateDisplay);
  await expect(row.first()).toBeVisible({ timeout: globalConfig.stepTimeoutMs });
  await verification.captureStep(testInfo, "future-dayoff-row-found");

  // Step 4: Verify edit icon IS visible (baseline — should work pre and post #3404)
  const hasEdit = await dayOffPage.hasEditButton(data.dateDisplay);
  expect(hasEdit).toBe(true);
  await verification.captureStep(testInfo, "edit-icon-visible-future-dayoff");

  // Cleanup
  await logout.runViaDirectUrl();
  await page.close();
});
