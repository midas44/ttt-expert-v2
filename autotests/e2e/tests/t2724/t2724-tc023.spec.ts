import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc023Data } from "../../data/t2724/T2724Tc023Data";
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
 * TC-T2724-023: Apply — page reloads after successful apply.
 * After apply succeeds, the saga calls window.location.reload().
 * This test verifies that apply succeeds and the page can reload cleanly
 * afterward with the planner in a consistent state.
 */
test("TC-T2724-023: Apply — page reloads after successful apply @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc023Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // SETUP: Create tag via DB
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

    // Trigger apply via same-origin fetch
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

    // Simulate the page reload the saga triggers (window.location.reload)
    await page.reload({ waitUntil: "domcontentloaded" });
    await plannerPage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "planner-after-reload");

    // DB-CHECK: Assignment should be closed after apply + reload
    const db = new DbClient(tttConfig);
    try {
      const closed = await getAssignmentClosedStatus(db, data.assignmentId);
      expect(closed).toBe(true);
    } finally {
      await db.close();
    }
    await verification.captureStep(testInfo, "apply-reload-confirmed");
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
