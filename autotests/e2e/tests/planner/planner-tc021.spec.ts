import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc021Data } from "../../data/planner/PlannerTc021Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-021: Drag task to reorder within project group.
 * Verifies that DnD reorder moves a task to a new position and the visual
 * order updates immediately. Uses mouse-based drag for react-beautiful-dnd.
 */
test("TC-PLN-021: Drag task to reorder within project group @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc021Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Navigate backward to the target date
  for (let i = 0; i < data.daysBack; i++) {
    await plannerPage.navigateDateBackward();
    await globalConfig.delay();
  }
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Enter editing mode — clicks global/per-employee "Open for editing" buttons
  let editMode = await plannerPage.enterProjectsEditMode();
  if (!editMode) {
    for (let attempt = 0; attempt < 5; attempt++) {
      await plannerPage.navigateDateBackward();
      await globalConfig.delay();
      await page.waitForLoadState("networkidle");
      await globalConfig.delay();
      editMode = await plannerPage.enterProjectsEditMode();
      if (editMode) break;
    }
  }
  if (!editMode) {
    test.skip(true, "Could not activate editing mode with DnD handles");
    return;
  }

  // Get only the first few DnD row task names (avoids iterating 400+ rows)
  const initialNames = await plannerPage.getFirstDndRowTaskNames(10);
  if (initialNames.length < 3) {
    test.skip(true, `Only ${initialNames.length} editable rows, need 3+`);
    return;
  }
  await verification.captureStep(testInfo, "dnd-handles-visible");

  // DnD: move 2nd task above 1st using mouse drag
  const editableRows = plannerPage.dndEditableRows();
  const secondTaskName = initialNames[1];
  await plannerPage.dragTaskWithMouse(editableRows.nth(1), editableRows.nth(0));
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Verify: second task should now be first
  const reorderedNames = await plannerPage.getFirstDndRowTaskNames(10);
  expect(reorderedNames[0]).toBe(secondTaskName);
  await verification.captureStep(testInfo, "task-reordered");

  await logout.runViaDirectUrl();
  await page.close();
});
