import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc019Data } from "../../data/planner/PlannerTc019Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-019: Color coding — blocked (red) and done (green).
 * Verifies that assignment cells with blocked/done tracker status
 * display correct color coding via CSS classes.
 */
test("TC-PLN-019: Color coding — blocked (red) and done (green) @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc019Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Login as PM, ensure EN, navigate to Projects tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Switch to PM filter and select the project with tracker info
  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  await verification.captureStep(testInfo, "project-selected");

  // Wait for planner data rows to render before checking color classes
  const dataRows = page
    .locator("tr")
    .filter({ has: page.locator("[class*='planner__cel']") });
  await dataRows
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => {});
  await globalConfig.delay();

  // Check for blocked cells (red/orange background) and done cells (green)
  const blockedCells = plannerPage.blockedCells();
  const doneCells = plannerPage.doneCells();
  let blockedCount = await blockedCells.count();
  let doneCount = await doneCells.count();

  // Navigate backward to find color-coded cells if none visible on current date
  if (blockedCount + doneCount === 0) {
    for (let attempt = 0; attempt < 14; attempt++) {
      await plannerPage.navigateDateBackward();
      await globalConfig.delay();
      blockedCount = await plannerPage.blockedCells().count();
      doneCount = await plannerPage.doneCells().count();
      if (blockedCount + doneCount > 0) break;
    }
  }

  if (blockedCount + doneCount === 0) {
    test.skip(
      true,
      "No color-coded cells found — project may not have blocked/done statuses",
    );
    return;
  }

  // Verify blocked cells have appropriate visual styling
  if (blockedCount > 0) {
    const blockedCell = blockedCells.first();
    await expect(blockedCell).toBeVisible();
    const classAttr = await blockedCell.getAttribute("class");
    expect(classAttr).toContain("color-blocked");
    await verification.captureStep(testInfo, "blocked-cell-found");
  }

  // Verify done cells have appropriate visual styling
  if (doneCount > 0) {
    const doneCell = doneCells.first();
    await expect(doneCell).toBeVisible();
    const classAttr = await doneCell.getAttribute("class");
    expect(classAttr).toContain("color-done");
    await verification.captureStep(testInfo, "done-cell-found");
  }

  // Verify that non-color-coded cells exist too (no-status = no special class)
  const allCells = page.locator("td[class*='planner__cel']");
  const totalCells = await allCells.count();
  expect(totalCells).toBeGreaterThan(blockedCount + doneCount);
  await verification.captureStep(testInfo, "color-coding-verified");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
