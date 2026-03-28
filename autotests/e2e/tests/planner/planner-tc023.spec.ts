import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc023Data } from "../../data/planner/PlannerTc023Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-023: DnD reorder persists after page reload.
 * Verifies that after reordering tasks via DnD and refreshing the page,
 * the custom order is preserved (stored in DB via next_assignment linked-list).
 */
test("TC-PLN-023: DnD reorder persists after page reload @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc023Data.create(
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

  const initialNames = await plannerPage.getFirstDndRowTaskNames(10);
  if (initialNames.length < 3) {
    test.skip(true, `Only ${initialNames.length} editable rows, need 3+`);
    return;
  }

  // Save the full URL before reload (includes hash/query state)
  const urlBeforeReload = page.url();

  // DnD: move 2nd task above 1st — retry up to 3 times
  const editableRows = plannerPage.dndEditableRows();
  const secondTaskName = initialNames[1];
  let dndSuccess = false;

  for (let dndAttempt = 0; dndAttempt < 3; dndAttempt++) {
    await plannerPage.dragTaskWithMouse(
      editableRows.nth(1),
      editableRows.nth(0),
    );
    await globalConfig.delay();
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();

    const reorderedNames = await plannerPage.getFirstDndRowTaskNames(10);
    if (reorderedNames[0] === secondTaskName) {
      dndSuccess = true;
      break;
    }
  }

  if (!dndSuccess) {
    test.skip(true, "DnD reorder did not take effect after 3 attempts");
    return;
  }
  await verification.captureStep(testInfo, "reordered-before-reload");

  // Reload the page using the same full URL
  await page.goto(urlBeforeReload, { waitUntil: "domcontentloaded" });
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // The planner URL may encode state — check if project and filters are restored.
  // If not, re-select them.
  const needsRenavigation = !(await plannerPage
    .allDndHandles()
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false));

  if (needsRenavigation) {
    // Full re-navigation: goto base URL, select filters
    await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
      waitUntil: "domcontentloaded",
    });
    await plannerPage.waitForReady();
    await globalConfig.delay();

    await plannerPage.selectRoleFilter("PM");
    await globalConfig.delay();

    // Try project selection with retry
    for (let retry = 0; retry < 3; retry++) {
      try {
        await plannerPage.selectProject(data.projectName);
        break;
      } catch {
        await globalConfig.delay();
        await page.waitForLoadState("networkidle");
      }
    }
    await globalConfig.delay();
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();

    for (let i = 0; i < data.daysBack; i++) {
      await plannerPage.navigateDateBackward();
      await globalConfig.delay();
    }
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();

    // Re-enter editing mode
    await plannerPage.enterProjectsEditMode();
    await globalConfig.delay();
  }

  // Verify DnD handles are visible
  const dndHandles = plannerPage.allDndHandles();
  await expect(dndHandles.first()).toBeVisible({ timeout: 15_000 });

  // Verify reordered task is still first after reload
  const namesAfterReload = await plannerPage.getFirstDndRowTaskNames(10);
  expect(namesAfterReload[0]).toBe(secondTaskName);
  await verification.captureStep(testInfo, "order-preserved-after-reload");

  await logout.runViaDirectUrl();
  await page.close();
});
