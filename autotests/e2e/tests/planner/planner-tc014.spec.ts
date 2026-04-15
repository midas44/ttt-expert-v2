import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc014Data } from "../../data/planner/PlannerTc014Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-014: Edit comment in comment cell.
 * Verifies that clicking the comment cell opens an editor,
 * and typing a comment saves it.
 */
test("TC-PLN-014: Edit comment in comment cell @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc014Data.create(
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

  // Step 3: Find the comment cell and click it to start editing (two-click: focus → edit)
  const commentCell = plannerPage.getCommentCell(taskRow.first());
  await plannerPage.clickCellToEdit(commentCell);
  await globalConfig.delay();

  // Step 4: Verify editor appears — comment uses rich text editor
  // The editor is a contenteditable element inside a wrapper div with class 'rich-edit'
  const richEditWrapper = commentCell.locator("[class*='rich-edit']").first();
  await expect(richEditWrapper).toBeVisible({ timeout: 5_000 });

  // Step 5: Click inside the rich text area and type a comment using keyboard
  await richEditWrapper.click();
  await globalConfig.delay();
  // Select all existing text and replace with new comment
  await page.keyboard.press("Control+a");
  const commentText = "Autotest comment";
  await page.keyboard.type(commentText);
  await verification.captureStep(testInfo, "comment-entered");

  // Step 6: Click outside the cell to confirm (rich text saves on blur)
  await plannerPage.getTaskRow(displayName).first().locator("td").first().click();
  await globalConfig.delay();

  // Step 7: Verify comment is saved — cell should contain the text
  await expect(commentCell).toContainText(commentText, { timeout: 5_000 });
  await verification.captureStep(testInfo, "comment-saved");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
