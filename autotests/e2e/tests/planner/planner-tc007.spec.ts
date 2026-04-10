import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc007Data } from "../../data/planner/PlannerTc007Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-007: Empty state — no assignments for date.
 * Navigates to a weekend date where the employee has no task assignments
 * and verifies the table shows only header and Total row with 0.
 */
test("TC-PLN-007: Empty state — no assignments for date @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc007Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 0: Login, ensure EN, go to planner Tasks tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_TASK`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 1: Navigate backward to the empty weekend date
  for (let i = 0; i < data.daysBack; i++) {
    await plannerPage.navigateDateBackward();
  }
  await globalConfig.delay();
  await verification.captureStep(testInfo, "navigated-to-empty-date");

  // Step 2: Verify the Total row is visible and shows 0
  await expect(plannerPage.totalRow()).toBeVisible();
  await expect(plannerPage.totalRow()).toContainText("0");

  // Step 3: Verify no project group headers (no expand buttons = no assignments)
  const groupCount = await plannerPage.expandButtons().count();
  expect(groupCount).toBe(0);
  await verification.captureStep(testInfo, "empty-state-verified");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
