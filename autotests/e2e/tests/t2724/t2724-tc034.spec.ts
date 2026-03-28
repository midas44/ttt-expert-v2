import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc034Data } from "../../data/t2724/T2724Tc034Data";
import { DbClient } from "../../config/db/dbClient";
import {
  insertTag,
  deleteTagByName,
  reopenAssignment,
} from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-034: Bug 8 regression — auto-refresh after closing.
 * Verifies the page auto-reloads (window.location.reload()) after clicking OK
 * in Project Settings when tags exist. Fixed by !5335/!5339.
 * Previously required manual page reload.
 */
test("TC-T2724-034: Bug 8 regression — auto-refresh after closing @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc034Data.create(
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

  // SETUP: Insert tag matching the assignment's ticket_info
  const setupDb = new DbClient(tttConfig);
  try {
    await insertTag(setupDb, data.projectId, data.tagValue);
  } finally {
    await setupDb.close();
  }

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
    await verification.captureStep(testInfo, "planner-before-apply");

    // Inject marker into current DOM to detect reload
    await page.evaluate(() => {
      document.body.dataset.tc034marker = "set";
    });

    // Open Project Settings and click OK (triggers apply + reload)
    await plannerPage.clickProjectSettingsIcon();
    await settingsDialog.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "settings-dialog-opened");

    await settingsDialog.clickOk();

    // Verify page reloads: marker should disappear because DOM is replaced
    const reloaded = await page
      .waitForFunction(() => !document.body.dataset.tc034marker, {
        timeout: 30000,
      })
      .then(() => true)
      .catch(() => false);

    expect(reloaded, "Page should auto-reload after OK click (window.location.reload)").toBe(true);

    if (reloaded) {
      // Wait for planner to render after reload
      await plannerPage.waitForReady();
      await globalConfig.delay();
      await verification.captureStep(testInfo, "page-auto-refreshed");
    }
  } finally {
    // CLEANUP: Remove tag and reopen assignment
    const cleanDb = new DbClient(tttConfig);
    try {
      await deleteTagByName(cleanDb, data.projectId, data.tagValue);
      if (data.assignmentId) {
        await reopenAssignment(cleanDb, data.assignmentId);
      }
    } finally {
      await cleanDb.close();
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
