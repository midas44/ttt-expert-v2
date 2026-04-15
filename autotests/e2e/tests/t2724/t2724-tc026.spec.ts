import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc026Data } from "../../data/t2724/T2724Tc026Data";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  insertTag,
  deleteTagByName,
  insertAssignment,
  deleteAssignment,
  findAssignmentByTaskEmployeeDate,
} from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-T2724-026: Apply after 'Open for editing' — newly generated assignments eligible.
 * Simulates the "open for editing" flow by inserting a new open assignment,
 * then applies close-by-tag and verifies the new assignment gets closed.
 * This tests that regular (non-createForCloseByTag) assignments are eligible.
 */
test("TC-T2724-026: Apply after Open for editing — newly generated assignments eligible @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc026Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // SETUP: Insert a new open assignment (simulating "open for editing")
  const setupDb = new DbClient(tttConfig);
  let createdAssignmentId: number | null = null;
  try {
    createdAssignmentId = await insertAssignment(
      setupDb, data.taskId, data.employeeId, data.targetDate,
    );
    await insertTag(setupDb, data.projectId, data.tagValue);
  } finally {
    await setupDb.close();
  }

  try {
    await login.run();
    await mainFixture.ensureLanguage("EN");

    // Navigate to planner (establishes same-origin context)
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

    // Verify assignment exists and is open before apply
    const dbBefore = new DbClient(tttConfig);
    try {
      const before = await findAssignmentByTaskEmployeeDate(
        dbBefore, data.taskId, data.employeeId, data.targetDate,
      );
      expect(before).not.toBeNull();
      expect(before!.closed).toBe(false);
    } finally {
      await dbBefore.close();
    }

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
      { url: applyUrl, token: tttConfig.apiToken, date: data.targetDate },
    );
    expect(applyResult.status).toBe(200);
    await globalConfig.delay();

    // DB-CHECK: The newly created assignment should now be closed
    const dbAfter = new DbClient(tttConfig);
    try {
      const after = await findAssignmentByTaskEmployeeDate(
        dbAfter, data.taskId, data.employeeId, data.targetDate,
      );
      expect(after).not.toBeNull();
      expect(after!.closed).toBe(true);
    } finally {
      await dbAfter.close();
    }
    await verification.captureStep(testInfo, "new-assignment-closed-after-apply");
  } finally {
    const db = new DbClient(tttConfig);
    try {
      await deleteTagByName(db, data.projectId, data.tagValue);
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
