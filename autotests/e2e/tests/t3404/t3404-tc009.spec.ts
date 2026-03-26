import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T3404Tc009Data } from "../../data/t3404/T3404Tc009Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";

/**
 * TC-T3404-009: Previous year (2025) — all edit icons hidden.
 * Previous year is fully closed, so no day-off should have an edit icon.
 */
test("TC-T3404-009: Previous year all hidden @regress @t3404", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T3404Tc009Data.create(
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

  // Step 3: Switch year selector to previous year
  await dayOffPage.selectYear(data.previousYear);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "previous-year-selected");

  // Step 4: Verify NO edit icons are visible for any row
  const rowCount = await dayOffPage.getRowCount();
  expect(rowCount).toBeGreaterThan(0); // Should have day-off entries in 2025

  // Check that no row has an edit button by scanning all rows
  const editButtonCount = await page
    .locator("table tbody tr [data-testid='dayoff-action-edit']")
    .count();
  expect(editButtonCount).toBe(0);
  await verification.captureStep(testInfo, "no-edit-icons-previous-year");

  // Cleanup
  await logout.runViaDirectUrl();
  await page.close();
});
