import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc035Data } from "../../data/t2724/T2724Tc035Data";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  insertTag,
  deleteTagByName,
  reopenAssignment,
  getAssignmentPositions,
} from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";
import { ProjectSettingsDialog } from "@ttt/pages/ProjectSettingsDialog";

/**
 * TC-T2724-035: Task order not disrupted after close-by-tag apply.
 * Verifies that remaining (non-closed) assignments preserve their position
 * column values after close-by-tag apply + page reload.
 * Close-by-tag publishes TaskAssignmentPatchEvent/GenerateEvent which may
 * trigger the #3314 re-sort bug. Related to #3332.
 */
test("TC-T2724-035: Task order not disrupted after close-by-tag apply @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc035Data.create(
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

  // Record assignment positions BEFORE apply
  const preDb = new DbClient(tttConfig);
  let positionsBefore: { assignment_id: number; task_name: string; position: number; closed: boolean; date: string }[];
  try {
    positionsBefore = await getAssignmentPositions(
      preDb, data.projectId, data.assigneeId,
    );
  } finally {
    await preDb.close();
  }

  console.log(`Positions before apply (${positionsBefore.length} assignments):`);
  for (const p of positionsBefore) {
    console.log(`  id=${p.assignment_id} task="${p.task_name}" pos=${p.position} closed=${p.closed} date=${p.date}`);
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

    // Inject marker for reload detection
    await page.evaluate(() => {
      document.body.dataset.tc035marker = "set";
    });

    // Open Project Settings and click OK (triggers apply)
    await plannerPage.clickProjectSettingsIcon();
    await settingsDialog.waitForReady();
    await globalConfig.delay();
    await settingsDialog.clickOk();

    // Wait for potential reload
    await page
      .waitForFunction(() => !document.body.dataset.tc035marker, {
        timeout: 30000,
      })
      .catch(() => {
        console.log("No page reload detected — apply may not have triggered");
      });
    await globalConfig.delay();

    // Re-wait for planner after reload
    await plannerPage.waitForReady().catch(() => {});
    await globalConfig.delay();
    await verification.captureStep(testInfo, "planner-after-apply");

    // DB-CHECK: Verify positions of non-closed assignments are unchanged
    const postDb = new DbClient(tttConfig);
    let positionsAfter: typeof positionsBefore;
    try {
      positionsAfter = await getAssignmentPositions(
        postDb, data.projectId, data.assigneeId,
      );
    } finally {
      await postDb.close();
    }

    console.log(`Positions after apply (${positionsAfter.length} assignments):`);
    for (const p of positionsAfter) {
      console.log(`  id=${p.assignment_id} task="${p.task_name}" pos=${p.position} closed=${p.closed} date=${p.date}`);
    }

    // Filter to non-closed assignments that existed before apply
    const survivingBefore = positionsBefore.filter((p) => !p.closed);
    for (const before of survivingBefore) {
      const after = positionsAfter.find((a) => a.assignment_id === before.assignment_id);
      if (after && !after.closed) {
        expect
          .soft(
            after.position,
            `Position of assignment ${before.assignment_id} (${before.task_name}) should be preserved`,
          )
          .toBe(before.position);
      }
    }

    // Verify no duplicate rows: each assignment_id should appear at most once
    const afterIds = positionsAfter.map((p) => p.assignment_id);
    const uniqueIds = new Set(afterIds);
    expect(uniqueIds.size, "No duplicate assignment rows").toBe(afterIds.length);
  } finally {
    // CLEANUP: Remove tag and reopen closed assignment
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
