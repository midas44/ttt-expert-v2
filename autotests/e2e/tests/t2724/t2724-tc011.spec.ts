import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc011Data } from "../../data/t2724/T2724Tc011Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-011: Permission — senior manager can CRUD tags.
 * Verifies that an SPM (senior_manager_id on the project) can create and
 * delete close tags. The SPM role filter is "SPM".
 */
test("TC-T2724-011: Senior manager can CRUD tags @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc011Data.create(
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

  // Step 1: Login as SPM and ensure English
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Planner > Projects, filter by SPM role
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();
  await plannerPage.selectRoleFilter("SPM");
  await globalConfig.delay();
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();

  // Step 3: Open Project Settings > Tasks closing
  await plannerPage.clickProjectSettingsIcon();
  await settingsDialog.waitForReady();
  await settingsDialog.clickTasksClosingTab();
  await globalConfig.delay();

  // Step 4: CREATE — add a tag
  await settingsDialog.addTag(data.tagCreate);
  await globalConfig.delay();
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  const tagsAfterCreate = await settingsDialog.getTagTexts();
  expect(tagsAfterCreate).toContain(data.tagCreate);
  await verification.captureStep(testInfo, "spm-tag-created");

  // Step 5: DELETE — remove the tag (self-cleaning)
  await settingsDialog.deleteTag(data.tagCreate);
  await globalConfig.delay();
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  const tagsAfterDelete = await settingsDialog.getTagTexts();
  expect(tagsAfterDelete).not.toContain(data.tagCreate);
  await verification.captureStep(testInfo, "spm-tag-deleted");

  await settingsDialog.clickOk();
  await logout.runViaDirectUrl();
  await page.close();
});
