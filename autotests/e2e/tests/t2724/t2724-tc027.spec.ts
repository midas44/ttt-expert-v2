import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc027Data } from "../../data/t2724/T2724Tc027Data";
import { DbClient } from "../../config/db/dbClient";
import {
  insertTag,
  deleteTagByName,
  getAssignmentClosedStatus,
  reopenAssignment,
} from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-T2724-027: Apply — multiple tags, partial matches.
 * Creates 2 tags with different values. Two assignments match different tags.
 * After apply, both matching assignments should be closed (OR logic).
 */
test("TC-T2724-027: Apply — multiple tags, partial matches @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc027Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // SETUP: Create 2 tags matching the 2 different ticket_info values
  const setupDb = new DbClient(tttConfig);
  try {
    await insertTag(setupDb, data.projectId, data.ticketInfo1);
    await insertTag(setupDb, data.projectId, data.ticketInfo2);
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
    await verification.captureStep(testInfo, "planner-before-multi-tag-apply");

    // Verify both assignments are open before apply
    const dbBefore = new DbClient(tttConfig);
    try {
      const closed1 = await getAssignmentClosedStatus(dbBefore, data.assignment1Id);
      const closed2 = await getAssignmentClosedStatus(dbBefore, data.assignment2Id);
      expect(closed1).toBe(false);
      expect(closed2).toBe(false);
    } finally {
      await dbBefore.close();
    }

    // Apply for both dates — use a single evaluate call to avoid page context issues
    const applyUrl = `${tttConfig.appUrl}/api/ttt/v1/projects/${data.projectId}/close-tags/apply`;
    const applyResults = await page.evaluate(
      async ({ url, token, date1, date2 }) => {
        const results: Array<{ date: string; status: number; ok: boolean; body: string }> = [];
        for (const date of [date1, date2]) {
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", API_SECRET_TOKEN: token },
            body: JSON.stringify({ date }),
          });
          const body = await resp.text().catch(() => "");
          results.push({ date, status: resp.status, ok: resp.ok, body });
        }
        return results;
      },
      {
        url: applyUrl,
        token: tttConfig.apiToken,
        date1: data.assignment1Date,
        date2: data.assignment2Date,
      },
    );
    for (const r of applyResults) {
      if (r.status !== 200) {
        console.error(`Apply failed for date ${r.date} (${r.status}):`, r.body);
      }
      expect(r.status).toBe(200);
    }
    await globalConfig.delay();

    // DB-CHECK: Both assignments should be closed
    const dbAfter = new DbClient(tttConfig);
    try {
      const closed1 = await getAssignmentClosedStatus(dbAfter, data.assignment1Id);
      const closed2 = await getAssignmentClosedStatus(dbAfter, data.assignment2Id);
      expect(closed1).toBe(true);
      expect(closed2).toBe(true);
    } finally {
      await dbAfter.close();
    }
    await verification.captureStep(testInfo, "multi-tag-both-closed");
  } finally {
    const db = new DbClient(tttConfig);
    try {
      await deleteTagByName(db, data.projectId, data.ticketInfo1);
      await deleteTagByName(db, data.projectId, data.ticketInfo2);
      await reopenAssignment(db, data.assignment1Id);
      await reopenAssignment(db, data.assignment2Id);
    } finally {
      await db.close();
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
