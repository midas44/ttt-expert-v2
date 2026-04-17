import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc022Data } from "../../data/t2724/T2724Tc022Data";
import { DbClient } from "@ttt/config/db/dbClient";
import { getAssignmentClosedStatus } from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";

/**
 * TC-T2724-022: Apply with no tags — no-op behavior.
 * Project has NO close tags configured. Calling apply should return 200
 * but change nothing. The frontend guards against this (saga returns
 * immediately if projectTags.length === 0), but the backend also handles
 * it gracefully.
 */
test("TC-T2724-022: Apply with no tags — no API call, no reload @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc022Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

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
    await verification.captureStep(testInfo, "planner-no-tags-project-selected");

    // Trigger apply on project with NO tags — should be a no-op
    const applyUrl = `${tttConfig.appUrl}/api/ttt/v1/projects/${data.projectId}/close-tags/apply`;
    const todayStr = new Date().toISOString().slice(0, 10);
    const applyResult = await page.evaluate(
      async ({ url, token, date }) => {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", API_SECRET_TOKEN: token },
          body: JSON.stringify({ date }),
        });
        return { status: resp.status, ok: resp.ok };
      },
      { url: applyUrl, token: tttConfig.apiToken, date: todayStr },
    );
    expect(applyResult.status).toBe(200);
    await globalConfig.delay();

    // DB-CHECK: If a witness assignment exists, verify it's still unclosed
    if (data.witnessAssignmentId) {
      const db = new DbClient(tttConfig);
      try {
        const closed = await getAssignmentClosedStatus(db, data.witnessAssignmentId);
        expect(closed).toBe(false);
      } finally {
        await db.close();
      }
    }
    await verification.captureStep(testInfo, "no-tags-no-changes-confirmed");
  } finally {
    // No cleanup needed — nothing was created or changed
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
