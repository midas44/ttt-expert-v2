import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc033Data } from "../../data/t2724/T2724Tc033Data";
import { DbClient } from "@ttt/config/db/dbClient";
import { deleteTagByName } from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";
import { ProjectSettingsDialog } from "@ttt/pages/ProjectSettingsDialog";

/**
 * TC-T2724-033: Bug 6 — cannot reopen popup on heavy data project.
 * After adding close tags on a heavy data project, reopening Project Settings
 * may hang with spinner (no network requests). Bug 6 is OPEN.
 * This test documents whether the bug is still reproducible.
 */
test("TC-T2724-033: Bug 6 — cannot reopen popup on heavy data project @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc033Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);
  const settingsDialog = new ProjectSettingsDialog(page);

  console.log(
    `Testing heavy-data project: ${data.projectName} (${data.assignmentCount} assignments)`,
  );

  try {
    await login.run();
    await mainFixture.ensureLanguage("EN");

    await page.goto(
      `${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`,
      { waitUntil: "domcontentloaded" },
    );
    await plannerPage.waitForReady();
    await globalConfig.delay();

    await plannerPage.selectRoleFilter("PM");
    await globalConfig.delay();
    await plannerPage.selectProject(data.projectName);
    await globalConfig.delay();

    // Open Project Settings > Tasks closing tab
    await plannerPage.clickProjectSettingsIcon();
    await settingsDialog.waitForReady();
    await settingsDialog.clickTasksClosingTab();
    await globalConfig.delay();

    // Add tag via UI (not DB insert — ensures UI state is consistent)
    await settingsDialog.addTag(data.tagValue);
    await globalConfig.delay();

    // Verify tag appeared in the table
    const tags = await settingsDialog.getTagTexts();
    expect.soft(tags).toContain(data.tagValue);
    await verification.captureStep(testInfo, "tag-added-on-heavy-project");

    // Click OK — triggers apply + potential reload
    await page.evaluate(() => {
      document.body.dataset.tc033marker = "set";
    });
    await settingsDialog.clickOk();

    // Wait for potential reload (allow extra time for heavy project)
    const reloaded = await page
      .waitForFunction(() => !document.body.dataset.tc033marker, {
        timeout: 30000,
      })
      .then(() => true)
      .catch(() => false);

    if (reloaded) {
      await plannerPage.waitForReady();
      await globalConfig.delay();
      await verification.captureStep(testInfo, "page-reloaded-after-ok");
    } else {
      // Dialog may have just closed without reload
      await globalConfig.delay();
      await verification.captureStep(testInfo, "no-reload-after-ok");
    }

    // Re-select project if needed (page may have reloaded)
    const settingsVisible = await plannerPage.isProjectSettingsIconVisible();
    if (!settingsVisible) {
      await plannerPage.selectRoleFilter("PM");
      await globalConfig.delay();
      await plannerPage.selectProject(data.projectName);
      await globalConfig.delay();
    }

    // Core test: attempt to reopen Project Settings
    const reopenStart = Date.now();
    await plannerPage.clickProjectSettingsIcon();

    // Wait for dialog — Bug 6 manifests as a hang here
    const dialogOpened = await settingsDialog
      .root()
      .waitFor({ state: "visible", timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    const reopenTime = Date.now() - reopenStart;

    if (dialogOpened) {
      console.log(`Dialog reopened successfully in ${reopenTime}ms`);
      await verification.captureStep(testInfo, "dialog-reopened-successfully");
      // Close via Escape (not OK — OK would trigger apply again on heavy project)
      await page.keyboard.press("Escape");
      await page
        .getByRole("dialog")
        .waitFor({ state: "hidden", timeout: 15000 })
        .catch(() => {});
    } else {
      console.log(
        `Bug 6 REPRODUCED: Dialog did not open within 30s ` +
        `(heavy project: ${data.assignmentCount} assignments)`,
      );
      await verification.captureStep(testInfo, "bug6-reproduced-dialog-hung");
    }

    // Soft assertion — document the result without hard-failing
    expect
      .soft(dialogOpened, "Bug 6: Dialog should reopen on heavy-data project")
      .toBe(true);
  } finally {
    // CLEANUP: Remove the test tag via DB
    const cleanDb = new DbClient(tttConfig);
    try {
      await deleteTagByName(cleanDb, data.projectId, data.tagValue);
    } finally {
      await cleanDb.close();
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
