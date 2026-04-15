import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc037Data } from "../../data/t2724/T2724Tc037Data";
import { DbClient } from "@ttt/config/db/dbClient";
import { deleteTagByName } from "../../data/t2724/queries/t2724Queries";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";
import { ProjectSettingsDialog } from "@ttt/pages/ProjectSettingsDialog";

/**
 * TC-T2724-037: Confluence discrepancy — 200 char limit not enforced.
 * Confluence §7.4.2 specifies 200-char limit on tag input.
 * DB allows VARCHAR(255). Frontend has no maxLength attribute.
 * This test documents the actual boundary behavior:
 * - Verifies no maxlength attribute on input
 * - Types 201 chars and adds the tag
 * - Verifies the tag is accepted (proving the 200-char limit is not enforced)
 */
test("TC-T2724-037: Confluence discrepancy — 200 char limit not enforced @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc037Data.create(
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

    // Open Project Settings > Tasks closing tab
    await plannerPage.clickProjectSettingsIcon();
    await settingsDialog.waitForReady();
    await settingsDialog.clickTasksClosingTab();
    await globalConfig.delay();

    // Verify no maxlength attribute on tag input (Confluence says 200, but no enforcement)
    const maxLength = await settingsDialog.getTagInputMaxLength();
    console.log(`Tag input maxlength attribute: ${maxLength}`);
    expect
      .soft(maxLength, "No maxlength attribute on tag input — Confluence §7.4.2 discrepancy")
      .toBeNull();
    await verification.captureStep(testInfo, "no-maxlength-attribute");

    // Type 201-character tag and add it
    console.log(`Adding tag of length ${data.longTag.length}: "${data.longTag.substring(0, 30)}..."`);
    await settingsDialog.addTag(data.longTag);
    await globalConfig.delay();

    // Verify tag was accepted (appears in table)
    const tags = await settingsDialog.getTagTexts();
    const tagAdded = tags.some((t) => t.startsWith("tc037-boundary-"));
    expect
      .soft(tagAdded, "201-char tag accepted — DB allows 255, frontend has no limit")
      .toBe(true);
    await verification.captureStep(testInfo, "201-char-tag-accepted");

    // Close dialog via Escape (avoid triggering apply)
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await globalConfig.delay();
  } finally {
    // CLEANUP: Remove the test tag via DB
    const cleanDb = new DbClient(tttConfig);
    try {
      await deleteTagByName(cleanDb, data.projectId, data.longTag);
    } finally {
      await cleanDb.close();
    }

    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
