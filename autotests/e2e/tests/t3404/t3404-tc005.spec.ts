import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T3404Tc005Data } from "../../data/t3404/T3404Tc005Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";

/**
 * TC-T3404-005: Edit icon visible for PAST day-off in open month (core new behavior).
 * Ticket #3404 changed edit visibility from date-based (>= today) to approve-period-based.
 * A past day-off within the open approve period should now show the edit (pencil) icon.
 */
test("TC-T3404-005: Edit icon visible for PAST day-off in open month @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc005Data.create(
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

  // Step 3: Find the day-off row with a past date in the open approve period
  const row = dayOffPage.dayOffRow(data.dateDisplay);
  await expect(row.first()).toBeVisible({ timeout: globalConfig.stepTimeoutMs });
  await verification.captureStep(testInfo, "past-dayoff-row-found");

  // Step 4: Verify edit icon IS visible (core #3404 behavior)
  const hasEdit = await dayOffPage.hasEditButton(data.dateDisplay);
  expect(hasEdit).toBe(true);
  await verification.captureStep(testInfo, "edit-icon-visible-past-dayoff");

  // Cleanup
  await logout.runViaDirectUrl();
  await page.close();
});
