import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc006Data } from "../../data/planner/PlannerTc006Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-006: Search for task by name.
 * Verifies that the search bar autocomplete shows suggestions matching
 * project name / task name as the user types.
 */
test("TC-PLN-006: Search for task by name @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc006Data.create(
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

  // Navigate to a weekday where the employee has a DB assignment.
  if (data.daysBack > 0) {
    for (let i = 0; i < data.daysBack; i++) {
      await plannerPage.navigateDateBackward();
      await globalConfig.delay();
    }
  }

  // Click "Open for editing" if readonly assignments exist.
  // This creates DB records for auto-generated rows, making
  // hasReadonlyAssignment false so SearchContainer renders.
  await plannerPage.openForEditingIfNeeded();
  await globalConfig.delay();

  // Step 1: Verify search bar is visible (requires open period + editing mode)
  await expect(plannerPage.searchInput()).toBeVisible({ timeout: 10_000 });
  await verification.captureStep(testInfo, "search-bar-visible");

  // Step 2: Type first 3 characters of a known project name
  const searchText = data.projectName.substring(0, 3);
  await plannerPage.typeInSearch(searchText);

  // Wait for the suggestions dropdown to appear (300ms debounce + API call)
  await expect(plannerPage.suggestionsDropdown()).toBeVisible({
    timeout: 10_000,
  });
  await globalConfig.delay();

  // Step 3: Verify at least one suggestion appears
  const suggestionsCount = await plannerPage.suggestionItems().count();
  expect(suggestionsCount).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "suggestions-visible");

  // Step 4: Dismiss suggestions by pressing Escape
  await page.keyboard.press("Escape");
  await globalConfig.delay();

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
