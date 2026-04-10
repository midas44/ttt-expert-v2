import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc025Data } from "../../data/t2724/T2724Tc025Data";
import { DbClient } from "../../config/db/dbClient";
import {
  insertTag,
  deleteTagByName,
  findAssignmentByTaskEmployeeDate,
  deleteAssignment,
} from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-T2724-025: Apply — generated (not-yet-opened) assignments also closed.
 * When an employee is bound to a task but no task_assignment exists for a given
 * date (i.e., the planner hasn't been "opened for editing"), close-by-tag should
 * still create the assignment as closed via createForCloseByTag().
 */
test("TC-T2724-025: Apply — generated (not-yet-opened) assignments also closed @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc025Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // SETUP: Create tag matching ticket_info via DB
  const setupDb = new DbClient(tttConfig);
  try {
    await insertTag(setupDb, data.projectId, data.tagValue);
  } finally {
    await setupDb.close();
  }

  // Track any assignment created by apply for cleanup
  let createdAssignmentId: number | null = null;

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
    await verification.captureStep(testInfo, "planner-project-selected");

    // Verify no assignment exists before apply
    const dbBefore = new DbClient(tttConfig);
    try {
      const before = await findAssignmentByTaskEmployeeDate(
        dbBefore, data.taskId, data.boundEmployeeId, data.targetDate,
      );
      expect(before).toBeNull();
    } finally {
      await dbBefore.close();
    }

    // Trigger apply for the target date
    const applyUrl = `${tttConfig.appUrl}/api/ttt/v1/projects/${data.projectId}/close-tags/apply`;
    const applyResult = await page.evaluate(
      async ({ url, token, date }) => {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", API_SECRET_TOKEN: token },
          body: JSON.stringify({ date }),
        });
        const body = await resp.text().catch(() => "");
        return { status: resp.status, ok: resp.ok, body };
      },
      { url: applyUrl, token: tttConfig.apiToken, date: data.targetDate },
    );
    if (applyResult.status !== 200) {
      console.error(`Apply failed (${applyResult.status}):`, applyResult.body);
    }
    expect(applyResult.status).toBe(200);
    await globalConfig.delay();

    // DB-CHECK: A new assignment should have been created as closed
    const dbAfter = new DbClient(tttConfig);
    try {
      const after = await findAssignmentByTaskEmployeeDate(
        dbAfter, data.taskId, data.boundEmployeeId, data.targetDate,
      );
      expect(after).not.toBeNull();
      expect(after!.closed).toBe(true);
      createdAssignmentId = after!.id;
    } finally {
      await dbAfter.close();
    }
    await verification.captureStep(testInfo, "generated-assignment-closed-confirmed");
  } finally {
    const db = new DbClient(tttConfig);
    try {
      await deleteTagByName(db, data.projectId, data.tagValue);
      // Clean up the assignment created by apply
      if (createdAssignmentId) {
        await deleteAssignment(db, createdAssignmentId);
      }
    } finally {
      await db.close();
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
