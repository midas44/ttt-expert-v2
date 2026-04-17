import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc024Data } from "../../data/planner/PlannerTc024Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-024: Bug #3332 — DnD should not create duplicate task rows.
 * Regression test: after DnD reorder, the row count must stay the same.
 * Root cause: generateTaskAssignments.ts appends new ID without removing old.
 */
test("TC-PLN-024: Bug #3332 -- DnD should not create duplicate task rows @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc024Data.create(
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

  for (let i = 0; i < data.daysBack; i++) {
    await plannerPage.navigateDateBackward();
    await globalConfig.delay();
  }
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Enter editing mode
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
    test.skip(true, "Could not activate editing mode");
    return;
  }

  // Count total DnD-editable rows
  const editableRows = plannerPage.dndEditableRows();
  const countBefore = await editableRows.count();
  if (countBefore < 3) {
    test.skip(true, `Only ${countBefore} editable rows, need 3+`);
    return;
  }
  await verification.captureStep(testInfo, "initial-row-count");

  // DnD iteration 1: move 2nd task above 1st
  await plannerPage.dragTaskWithMouse(editableRows.nth(1), editableRows.nth(0));
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Verify no duplicates after DnD #1 (row count unchanged)
  const countAfter1 = await editableRows.count();
  expect(countAfter1).toBe(countBefore);
  await verification.captureStep(testInfo, "after-dnd-1");

  // DnD iteration 2: move 3rd task above 2nd (reverse direction)
  await plannerPage.dragTaskWithMouse(editableRows.nth(2), editableRows.nth(1));
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  const countAfter2 = await editableRows.count();
  expect(countAfter2).toBe(countBefore);
  await verification.captureStep(testInfo, "after-dnd-2-no-duplicates");

  await logout.runViaDirectUrl();
  await page.close();
});
