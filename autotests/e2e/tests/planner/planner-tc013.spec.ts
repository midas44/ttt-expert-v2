import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc013Data } from "../../data/planner/PlannerTc013Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-013: Edit hours in effort cell — inline editing.
 * Verifies clicking an effort cell makes it editable, entering a value saves it.
 */
test("TC-PLN-013: Edit hours in effort cell @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc013Data.create(
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

  // Navigate to the weekday with existing assignment
  if (data.daysBack > 0) {
    for (let i = 0; i < data.daysBack; i++) {
      await plannerPage.navigateDateBackward();
      await globalConfig.delay();
    }
  }

  // Wait for table to render — either search input or "Open for editing" button
  await page.waitForSelector(
    'input[name="TASK_NAME"], button:has-text("Open for editing")',
    { timeout: 15_000 },
  );
  await globalConfig.delay();

  // Ensure editing mode is active (handles "Open for editing" with retries)
  const editMode = await plannerPage.ensureEditMode();
  if (!editMode) {
    // If editing mode cannot be activated, skip — environment may have locked period
    test.skip(true, "Planner editing mode could not be activated — period may be locked");
    return;
  }
  await globalConfig.delay();

  // Step 1: Find the task row — planner strips the project name prefix from display
  const prefix = data.projectName + " / ";
  const displayName = data.taskName.startsWith(prefix)
    ? data.taskName.substring(prefix.length)
    : data.taskName;
  const taskRow = plannerPage.getTaskRow(displayName);
  await expect(taskRow.first()).toBeVisible({ timeout: 10_000 });

  // Step 2: Verify the row is editable (comment buttons not disabled)
  const editable = await plannerPage.isCellEditable(taskRow.first());
  if (!editable) {
    test.skip(true, "Task row is readonly — cannot test inline editing");
    return;
  }
  await verification.captureStep(testInfo, "task-row-found");

  // Step 3: Click on the effort (date) cell to start editing (two-click: focus → edit)
  const effortCell = plannerPage.getEffortCell(taskRow.first());
  await plannerPage.clickCellToEdit(effortCell);
  await globalConfig.delay();

  // Step 4: Verify cell becomes editable — input appears
  // The effort input has class 'planner__edit-effort__input' or is a generic input inside the cell
  const input = effortCell.locator("input").first();
  await expect(input).toBeVisible({ timeout: 10_000 });

  // Step 5: Clear and enter new value
  await input.clear();
  await input.type("4.5");
  await verification.captureStep(testInfo, "hours-entered");

  // Step 6: Press Enter to confirm (planner cells save on Enter)
  await page.keyboard.press("Enter");
  await globalConfig.delay();

  // Step 7: Verify the cell shows the saved value
  await expect(effortCell).toContainText("4.5", { timeout: 5_000 });
  await verification.captureStep(testInfo, "hours-saved");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
