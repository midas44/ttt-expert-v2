import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc004Data } from "../../data/planner/PlannerTc004Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-004: Select a project in Projects tab.
 * Verifies that selecting a project populates the table with employees.
 */
test("TC-PLN-004: Select a project in Projects tab @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc004Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 0: Login, ensure EN, go to Projects tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 1: Select PM role filter (to see managed projects)
  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();

  // Step 2: Click the project selector dropdown and select the project
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "project-selected");

  // Step 3: Verify table populates with employee rows
  const table = plannerPage.dataTable().first();
  await expect(table).toBeVisible();
  const rows = table.locator("tbody tr");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "employees-loaded");

  // Step 4: Verify project name appears in the dropdown selection
  const selected = await plannerPage.getSelectedProjectName();
  expect(selected).toContain(data.projectName);

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
