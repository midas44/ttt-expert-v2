import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc015Data } from "../../data/planner/PlannerTc015Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-015: Edit remaining estimate.
 * Verifies clicking the "Remaining work" cell makes it editable and saves the value.
 */
test("TC-PLN-015: Edit remaining estimate @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc015Data.create(
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

  // Navigate to weekday with existing assignment
  if (data.daysBack > 0) {
    for (let i = 0; i < data.daysBack; i++) {
      await plannerPage.navigateDateBackward();
      await globalConfig.delay();
    }
  }

  // Wait for table to render
  await page.waitForSelector(
    'input[name="TASK_NAME"], button:has-text("Open for editing")',
    { timeout: 15_000 },
  );
  await globalConfig.delay();

  // Ensure editing mode is active
  const editMode = await plannerPage.ensureEditMode();
  if (!editMode) {
    test.skip(true, "Planner editing mode could not be activated — period may be locked");
    return;
  }
  await globalConfig.delay();

  // Step 1: Find the task row
  const prefix = data.projectName + " / ";
  const displayName = data.taskName.startsWith(prefix)
    ? data.taskName.substring(prefix.length)
    : data.taskName;
  const taskRow = plannerPage.getTaskRow(displayName);
  await expect(taskRow.first()).toBeVisible({ timeout: 10_000 });

  // Step 2: Verify the row is editable
  const editable = await plannerPage.isCellEditable(taskRow.first());
  if (!editable) {
    test.skip(true, "Task row is readonly — cannot test inline editing");
    return;
  }

  // Step 3: Click on the "Remaining work" cell to start editing (two-click: focus → edit)
  const remainingCell = plannerPage.getRemainingWorkCell(taskRow.first());
  await plannerPage.clickCellToEdit(remainingCell);
  await globalConfig.delay();

  // Step 4: Verify cell becomes editable — remaining work uses an autosuggest input
  const input = remainingCell.locator("input").first();
  await expect(input).toBeVisible({ timeout: 5_000 });

  // Step 5: Clear and enter new value
  await input.clear();
  await input.type("8");
  await verification.captureStep(testInfo, "remaining-entered");

  // Step 6: Press Enter to confirm (planner cells save on Enter, not Tab)
  await page.keyboard.press("Enter");
  await globalConfig.delay();

  // Step 7: Verify the value is saved — check cell text or input value
  await expect(remainingCell).toContainText("8", { timeout: 5_000 });
  await verification.captureStep(testInfo, "remaining-saved");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
