import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc002Data } from "../../data/planner/PlannerTc002Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-002: Switch between Tasks and Projects tabs.
 * Verifies that clicking Tasks/Projects tabs changes URL and content.
 */
test("TC-PLN-002: Switch between Tasks and Projects tabs @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc002Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 0: Login, ensure EN, go to planner
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_TASK`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 1: Click "Projects" tab
  await plannerPage.clickProjectsTab();
  await globalConfig.delay();

  // Step 2: Verify URL changes to Projects
  await expect(page).toHaveURL(/\/planner\/TABS_ASSIGNMENTS_PROJECT/);
  await verification.captureStep(testInfo, "projects-tab-active");

  // Step 3: Verify project selector dropdown appears
  await expect(plannerPage.projectSelectDropdown()).toBeVisible();

  // Step 4: Click "Tasks" tab
  await plannerPage.clickTasksTab();
  await globalConfig.delay();

  // Step 5: Verify URL changes back to Tasks
  await expect(page).toHaveURL(/\/planner\/TABS_ASSIGNMENTS_TASK/);
  await verification.captureStep(testInfo, "tasks-tab-active");

  // Step 6: Verify personal task table reappears (project dropdown gone)
  await expect(plannerPage.projectSelectDropdown()).not.toBeVisible();
  await expect(plannerPage.dataTable().first()).toBeVisible();

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
