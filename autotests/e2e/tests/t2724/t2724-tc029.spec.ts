import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc029Data } from "../../data/t2724/T2724Tc029Data";
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

/**
 * TC-T2724-029: Apply endpoint — API direct call.
 * Tests the apply REST endpoint behavior:
 *   1. POST with {date} on tagged project → 200, assignment closed
 *   2. POST with empty body (null date) → 200 (no-op)
 *   3. POST on project with no tags → 200 (no-op)
 */
test("TC-T2724-029: Apply endpoint — API direct call @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc029Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);

  // SETUP: Create tag matching ticket_info
  const setupDb = new DbClient(tttConfig);
  try {
    await insertTag(setupDb, data.projectId, data.tagValue);
  } finally {
    await setupDb.close();
  }

  try {
    await login.run();
    await mainFixture.ensureLanguage("EN");

    // Navigate to establish same-origin context for fetch calls
    await page.goto(
      `${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`,
      { waitUntil: "domcontentloaded" },
    );
    await globalConfig.delay();

    // --- Test 1: POST with valid date → should close matching assignment ---
    const applyUrl = `${tttConfig.appUrl}/api/ttt/v1/projects/${data.projectId}/close-tags/apply`;
    const result1 = await page.evaluate(
      async ({ url, token, date }) => {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", API_SECRET_TOKEN: token },
          body: JSON.stringify({ date }),
        });
        const body = await resp.text().catch(() => "");
        return { status: resp.status, ok: resp.ok, body };
      },
      { url: applyUrl, token: tttConfig.apiToken, date: data.assignmentDate },
    );
    expect(result1.status).toBe(200);

    // Verify assignment was closed
    const db1 = new DbClient(tttConfig);
    try {
      const closed = await getAssignmentClosedStatus(db1, data.assignmentId);
      expect(closed).toBe(true);
    } finally {
      await db1.close();
    }
    await verification.captureStep(testInfo, "api-apply-with-date-200");

    // --- Test 2: POST with empty body (null date) → 400 Bad Request ---
    // The backend validates the request body; missing date returns 400
    const result2 = await page.evaluate(
      async ({ url, token }) => {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", API_SECRET_TOKEN: token },
          body: JSON.stringify({}),
        });
        return { status: resp.status, ok: resp.ok };
      },
      { url: applyUrl, token: tttConfig.apiToken },
    );
    expect(result2.status).toBe(400);
    await verification.captureStep(testInfo, "api-apply-empty-body-400");

    // --- Test 3: POST on project with no tags → 200 no-op ---
    const noTagsUrl = `${tttConfig.appUrl}/api/ttt/v1/projects/${data.noTagsProjectId}/close-tags/apply`;
    const result3 = await page.evaluate(
      async ({ url, token, date }) => {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", API_SECRET_TOKEN: token },
          body: JSON.stringify({ date }),
        });
        return { status: resp.status, ok: resp.ok };
      },
      { url: noTagsUrl, token: tttConfig.apiToken, date: data.assignmentDate },
    );
    expect(result3.status).toBe(200);
    await verification.captureStep(testInfo, "api-apply-no-tags-200");
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
