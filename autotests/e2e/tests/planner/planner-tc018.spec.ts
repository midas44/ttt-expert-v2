import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc018Data } from "../../data/planner/PlannerTc018Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-018: Edit hours in Projects tab (manager view).
 * Verifies that a PM can edit employee hours on the Projects tab
 * after opening editing mode on an employee.
 */
test("TC-PLN-018: Edit hours in Projects tab (manager view) @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc018Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Login as PM, ensure EN, navigate to planner Projects tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Switch to PM role filter and select the project
  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Navigate to the weekday with the assignment
  if (data.daysBack > 0) {
    for (let i = 0; i < data.daysBack; i++) {
      await plannerPage.navigateDateBackward();
      await globalConfig.delay();
    }
  }
  await globalConfig.delay();

  // Handle "Open for editing" if present — click all visible buttons
  const openBtns = page.getByRole("button", { name: "Open for editing" });
  let btnCount = await openBtns.count();
  while (btnCount > 0) {
    await openBtns.first().click();
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();
    btnCount = await openBtns.count();
  }

  // Wait for table to fully render after editing mode activation
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  await verification.captureStep(testInfo, "editing-mode-active");

  // Wait for planner data rows to render (rows with planner__cel class cells)
  const taskRows = page
    .locator("tr")
    .filter({ has: page.locator("[class*='planner__cel']") });
  await taskRows.first().waitFor({ state: "visible", timeout: 15_000 });
  await globalConfig.delay();
  const taskRowCount = await taskRows.count();

  if (taskRowCount === 0) {
    test.skip(true, "No task rows with planner cells found");
    return;
  }

  const targetRow = taskRows.first();

  // Click the effort cell using two-click pattern
  const effortCell = plannerPage.getEffortCell(targetRow);
  await plannerPage.clickCellToEdit(effortCell);
  await globalConfig.delay();

  // Verify input appears in the cell
  const input = effortCell.locator("input").first();
  await expect(input).toBeVisible({ timeout: 10_000 });

  // Enter hours value
  await input.clear();
  await input.type("3");
  await verification.captureStep(testInfo, "hours-entered");

  // Press Enter to confirm
  await page.keyboard.press("Enter");
  await globalConfig.delay();

  // Verify the cell shows the saved value
  await expect(effortCell).toContainText("3", { timeout: 5_000 });
  await verification.captureStep(testInfo, "hours-saved");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
