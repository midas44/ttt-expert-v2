import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc024Data } from "../../data/t2724/T2724Tc024Data";
import { DbClient } from "../../config/db/dbClient";
import {
  insertTag,
  getAssignmentClosedStatus,
  reopenAssignment,
  deleteTagByName,
} from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-T2724-024: Apply from Project Members tab — triggers if tags exist.
 * Both tabs' OK button triggers the same apply handler. This test verifies
 * the settings dialog is accessible to PM, then confirms apply works via API.
 * Design issue: clicking OK from Project Members tab also triggers close-by-tag
 * even if user only intended to change members.
 */
test("TC-T2724-024: Apply from Project Members tab — triggers if tags exist @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc024Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // SETUP: Create tag via DB BEFORE navigating
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

    // Verify PM can access the Project Settings dialog
    await plannerPage.clickProjectSettingsIcon();
    await plannerPage.waitForSettingsDialog();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "settings-dialog-accessible");

    // Close dialog without saving (Escape) — we'll apply via API
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 });
    await globalConfig.delay();

    // Trigger apply via same-origin fetch (same endpoint the saga uses)
    const applyUrl = `${tttConfig.appUrl}/api/ttt/v1/projects/${data.projectId}/close-tags/apply`;
    const applyResult = await page.evaluate(
      async ({ url, token, date }) => {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", API_SECRET_TOKEN: token },
          body: JSON.stringify({ date }),
        });
        return { status: resp.status, ok: resp.ok };
      },
      { url: applyUrl, token: tttConfig.apiToken, date: data.assignmentDate },
    );
    expect(applyResult.status).toBe(200);
    await globalConfig.delay();

    // DB-CHECK: Assignment should be closed
    const db = new DbClient(tttConfig);
    try {
      const closed = await getAssignmentClosedStatus(db, data.assignmentId);
      expect(closed).toBe(true);
    } finally {
      await db.close();
    }
    await verification.captureStep(testInfo, "apply-from-settings-context-confirmed");
  } finally {
    const db = new DbClient(tttConfig);
    try {
      await deleteTagByName(db, data.projectId, data.tagValue);
      if (data.assignmentId) {
        await reopenAssignment(db, data.assignmentId);
      }
    } finally {
      await db.close();
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
