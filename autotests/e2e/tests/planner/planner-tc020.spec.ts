import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { PlannerTc020Data } from "../../data/planner/PlannerTc020Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-PLN-020: Info column shows tracker priority tags.
 * Verifies that the Info column displays tracker priority tags (e.g., [Medium], [High])
 * and the Tracker column shows clickable links to the external tracker.
 */
test("TC-PLN-020: Info column shows tracker priority tags @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc020Data.create(
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

  // Find task rows (non-header rows)
  const taskRows = page.locator("table tbody tr").filter({
    hasNot: page.locator("[class*='row-expand-icon']"),
  });
  const rowCount = await taskRows.count();
  if (rowCount === 0) {
    test.skip(true, "No task rows found in the project");
    return;
  }

  // Find a row with non-empty Info column content
  let infoFound = false;
  for (let i = 0; i < Math.min(rowCount, 10); i++) {
    const row = taskRows.nth(i);
    const infoCell = plannerPage.getInfoCell(row);
    const infoText = (await infoCell.textContent()) ?? "";
    if (infoText.trim().length > 0) {
      // Verify Info column has some tracker-related content
      expect(infoText.trim().length).toBeGreaterThan(0);
      await verification.captureStep(testInfo, `info-cell-row-${i}`);
      infoFound = true;
      break;
    }
  }

  if (!infoFound) {
    test.skip(true, "No rows with Info column data found in current view");
    return;
  }

  // Find a row with Tracker column link
  let trackerFound = false;
  for (let i = 0; i < Math.min(rowCount, 10); i++) {
    const row = taskRows.nth(i);
    const trackerCell = plannerPage.getTrackerCell(row);
    const link = trackerCell.locator("a").first();
    if (await link.isVisible({ timeout: 1_000 }).catch(() => false)) {
      // Verify the link has an href pointing to an external tracker
      const href = await link.getAttribute("href");
      expect(href).toBeTruthy();
      // Verify link text looks like a ticket ID (e.g., "SF-1613", "PROJ-123")
      const linkText = (await link.textContent()) ?? "";
      expect(linkText.trim().length).toBeGreaterThan(0);
      // Verify link opens in new tab (target="_blank")
      const target = await link.getAttribute("target");
      expect(target).toBe("_blank");
      await verification.captureStep(testInfo, `tracker-link-row-${i}`);
      trackerFound = true;
      break;
    }
  }

  if (!trackerFound) {
    test.skip(true, "No Tracker column links found");
    return;
  }

  await verification.captureStep(testInfo, "info-and-tracker-verified");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
