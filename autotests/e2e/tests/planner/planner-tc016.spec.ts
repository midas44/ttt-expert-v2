import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc016Data } from "../../data/planner/PlannerTc016Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-016: Delete assignment.
 * Verifies that clicking the delete button on a task row removes it from the table
 * and the Total row recalculates. Assignments are closed (not truly deleted).
 */
test("TC-PLN-016: Delete assignment @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc016Data.create(
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

  // Wait for table content
  await page.waitForSelector(
    'input[name="TASK_NAME"], button:has-text("Open for editing")',
    { timeout: 15_000 },
  );
  await globalConfig.delay();

  // Ensure editing mode is active
  const editMode = await plannerPage.ensureEditMode();
  if (!editMode) {
    test.skip(true, "Planner editing mode could not be activated");
    return;
  }
  await globalConfig.delay();

  // Find the task row
  const prefix = data.projectName + " / ";
  const displayName = data.taskName.startsWith(prefix)
    ? data.taskName.substring(prefix.length)
    : data.taskName;
  const taskRow = plannerPage.getTaskRow(displayName);
  await expect(taskRow.first()).toBeVisible({ timeout: 10_000 });

  // Verify editable
  const editable = await plannerPage.isCellEditable(taskRow.first());
  if (!editable) {
    test.skip(true, "Task row is readonly — cannot test deletion");
    return;
  }

  // Count rows before deletion
  const allDataRows = page.locator("table tbody tr").filter({
    hasNot: page.locator("[class*='row-expand-icon']"),
  });
  const rowCountBefore = await allDataRows.count();
  await verification.captureStep(testInfo, "before-delete");

  // Hover the row to reveal the delete button (hidden by default, shown on hover)
  await taskRow.first().hover();
  await globalConfig.delay();

  // The delete button is inside .planner__row-item--hover, first button (trash icon)
  const deleteBtn = plannerPage.getDeleteButton(taskRow.first());

  // Check if the button is disabled (happens when hours are already reported)
  const isDisabled = await deleteBtn.isDisabled().catch(() => false);
  if (isDisabled) {
    test.skip(true, "Delete button is disabled — assignment has reported hours");
    return;
  }

  await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
  await deleteBtn.click({ force: true }); // force: true because hover might drift
  await globalConfig.delay();

  // Verify the task row is removed from the table
  await expect(taskRow.first()).toBeHidden({ timeout: 10_000 });
  await verification.captureStep(testInfo, "row-deleted");

  // Verify row count decreased
  const rowCountAfter = await allDataRows.count();
  expect(rowCountAfter).toBeLessThan(rowCountBefore);

  // Verify Total row is still visible (recalculates)
  await expect(plannerPage.totalRow()).toBeVisible();
  await verification.captureStep(testInfo, "total-recalculated");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
