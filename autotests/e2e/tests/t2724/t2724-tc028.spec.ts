import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc028Data } from "../../data/t2724/T2724Tc028Data";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  insertTag,
  deleteTagByName,
  getAssignmentClosedStatus,
} from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-T2724-028: Apply — assignment with blank ticket_info is skipped.
 * Creates a tag for the project, triggers apply, and verifies that
 * an assignment whose task has NULL/empty ticket_info is NOT closed.
 * The close-by-tag code checks `if ticketInfo is blank, skip`.
 */
test("TC-T2724-028: Apply — assignment with blank ticket_info is skipped @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc028Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // SETUP: Create a tag (any value) so close-by-tag actually runs
  const dummyTag = "__autotest_blank_check__";
  const setupDb = new DbClient(tttConfig);
  try {
    await insertTag(setupDb, data.projectId, dummyTag);
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
    await verification.captureStep(testInfo, "planner-blank-info-before-apply");

    // Trigger apply
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

    // DB-CHECK: Assignment with blank ticket_info should remain OPEN
    const db = new DbClient(tttConfig);
    try {
      const closed = await getAssignmentClosedStatus(db, data.assignmentId);
      expect(closed).toBe(false);
    } finally {
      await db.close();
    }
    await verification.captureStep(testInfo, "blank-info-assignment-still-open");
  } finally {
    const db = new DbClient(tttConfig);
    try {
      await deleteTagByName(db, data.projectId, dummyTag);
    } finally {
      await db.close();
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
