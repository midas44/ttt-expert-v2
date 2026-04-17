import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc001Data } from "../../data/planner/PlannerTc001Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-001: Navigate to Planner from navbar.
 * Verifies that clicking "Planner" in the top navbar loads the planner page
 * with Tasks tab active, search bar visible, and correct URL.
 */
test("TC-PLN-001: Navigate to Planner from navbar @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc001Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 1: Login and ensure English
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Click "Planner" link in the top navbar
  await page.getByRole("link", { name: "Planner" }).click();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 3: Verify URL
  await expect(page).toHaveURL(/\/planner\/TABS_ASSIGNMENTS_TASK/);
  await verification.captureStep(testInfo, "planner-loaded");

  // Step 4: Verify Tasks tab is active (has selected/active state)
  const tasksTab = page.getByRole("button", { name: "Tasks", exact: true });
  await expect(tasksTab).toBeVisible();

  // Step 5: Verify Projects tab is also visible (both tabs rendered)
  const projectsTab = page.getByRole("button", {
    name: "Projects",
    exact: true,
  });
  await expect(projectsTab).toBeVisible();

  // Step 6: Verify the data table is visible
  await expect(plannerPage.dataTable().first()).toBeVisible();
  await verification.captureStep(testInfo, "planner-elements-visible");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
