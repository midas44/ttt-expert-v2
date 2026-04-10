import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc025Data } from "../../data/planner/PlannerTc025Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-025: Bug #3314 — task order preserved after 'Open for Editing' toggle.
 * Regression test: opening editing for employee B must NOT reset employee A's
 * DnD-reordered task order. Root cause: useEffect .sort() in TasksPlannerTable.tsx.
 */
test("TC-PLN-025: Bug #3314 -- task order preserved after Open for Editing @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc025Data.create(
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

  // Find employee A's header row and open editing for them
  const headerA = plannerPage.getEmployeeHeaderRow(data.employeeAName);

  // Search nearby dates if employee A's header isn't visible
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await headerA.isVisible({ timeout: 3_000 }).catch(() => false)) break;
    await plannerPage.navigateDateBackward();
    await globalConfig.delay();
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();
  }

  // Open editing for employee A via their per-employee button
  const openBtnA = plannerPage.getEmployeeOpenForEditingButton(headerA);
  if (await openBtnA.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await openBtnA.click();
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();
  } else {
    // Employee A might need the global "Open for editing" — use fallback
    const globalBtn = page.getByRole("button", { name: "Open for editing" });
    if (await globalBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await globalBtn.click();
      await page.waitForLoadState("networkidle");
      await globalConfig.delay();
    }
  }

  // Wait for DnD handles
  const dndHandles = plannerPage.allDndHandles();
  await expect(dndHandles.first()).toBeVisible({ timeout: 15_000 });
  await globalConfig.delay();

  // Get initial task names (first few DnD rows belong to employee A)
  const namesBeforeReorder = await plannerPage.getFirstDndRowTaskNames(10);
  if (namesBeforeReorder.length < 2) {
    test.skip(true, `Only ${namesBeforeReorder.length} editable rows`);
    return;
  }
  await verification.captureStep(testInfo, "before-reorder");

  // Reorder: move 2nd task above 1st
  const editableRows = plannerPage.dndEditableRows();
  const secondTaskName = namesBeforeReorder[1];
  await plannerPage.dragTaskWithMouse(editableRows.nth(1), editableRows.nth(0));
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Verify reorder
  const namesAfterReorder = await plannerPage.getFirstDndRowTaskNames(10);
  expect(namesAfterReorder[0]).toBe(secondTaskName);
  await verification.captureStep(testInfo, "after-reorder");

  // Now open editing for employee B — this triggers the bug if unfixed
  const headerB = plannerPage.getEmployeeHeaderRow(data.employeeBName);
  if (await headerB.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const openBtnB = plannerPage.getEmployeeOpenForEditingButton(headerB);
    if (await openBtnB.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await openBtnB.click();
      await page.waitForLoadState("networkidle");
      await globalConfig.delay();
    }
  }
  await globalConfig.delay();

  // Verify employee A's task order is PRESERVED after toggling B's editing
  const namesAfterToggle = await plannerPage.getFirstDndRowTaskNames(10);
  expect(namesAfterToggle[0]).toBe(secondTaskName);
  await verification.captureStep(testInfo, "order-preserved-after-toggle");

  await logout.runViaDirectUrl();
  await page.close();
});
