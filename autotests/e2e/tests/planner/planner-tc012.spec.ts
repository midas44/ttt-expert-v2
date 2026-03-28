import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc012Data } from "../../data/planner/PlannerTc012Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-012: Add task via search bar — happy path.
 * Verifies that typing a project/task in the search bar shows suggestions,
 * selecting one and clicking "Add a task" creates a new assignment row.
 */
test("TC-PLN-012: Add task via search bar — happy path @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc012Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Login, ensure EN, navigate to planner Tasks tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_TASK`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Navigate to the weekday where the employee has an existing assignment
  if (data.daysBack > 0) {
    for (let i = 0; i < data.daysBack; i++) {
      await plannerPage.navigateDateBackward();
      await globalConfig.delay();
    }
  }

  // Wait for the table to render — either search input or "Open for editing" button
  await page.waitForSelector(
    'input[name="TASK_NAME"], button:has-text("Open for editing")',
    { timeout: 15_000 },
  );
  await globalConfig.delay();

  // If "Open for editing" is visible, click it to switch to editing mode
  const openBtn = plannerPage.openForEditingButton();
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await openBtn.waitFor({ state: "hidden", timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();
  }

  // Step 1: Verify search bar is visible
  const searchInput = plannerPage.searchInput();
  await expect(searchInput).toBeVisible({ timeout: 10_000 });

  // Count rows before adding
  const rowsBefore = await page.locator("table tbody tr").count();

  // Step 2: Type first few chars of the project name to trigger suggestions
  await searchInput.fill(data.projectName.substring(0, 4));

  // Wait for suggestions dropdown
  await expect(plannerPage.suggestionsDropdown()).toBeVisible({
    timeout: 10_000,
  });
  await globalConfig.delay();

  // Step 3: Click the first suggestion
  await plannerPage.suggestionItems().first().click();
  await globalConfig.delay();

  // Step 4: Click "Add a task" button
  await plannerPage.addTaskButton().click();
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 5: Verify a new row appeared (count increased)
  const rowsAfter = await page.locator("table tbody tr").count();
  expect(rowsAfter).toBeGreaterThan(rowsBefore);
  await verification.captureStep(testInfo, "task-added");

  // Step 6: Verify Total row is present
  await expect(plannerPage.totalRow()).toBeVisible();
  await verification.captureStep(testInfo, "total-visible");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
