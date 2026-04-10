import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc010Data } from "../../data/t2724/T2724Tc010Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-010: Permission — PM can CRUD tags.
 * Verifies a PM can create, edit, and delete a close tag in one flow.
 * Self-cleaning: the created tag is deleted at the end.
 */
test("TC-T2724-010: PM can CRUD tags — full cycle @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc010Data.create(
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

  // Step 1: Login as PM and ensure English
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Project Settings > Tasks closing
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();
  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();
  await plannerPage.clickProjectSettingsIcon();
  await settingsDialog.waitForReady();
  await settingsDialog.clickTasksClosingTab();
  await globalConfig.delay();

  // Step 3: CREATE — add a tag
  await settingsDialog.addTag(data.tagCreate);
  await globalConfig.delay();
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  const tagsAfterCreate = await settingsDialog.getTagTexts();
  expect(tagsAfterCreate).toContain(data.tagCreate);
  await verification.captureStep(testInfo, "tag-created");

  // Step 4: EDIT — inline edit the tag
  await settingsDialog.clickTagToEdit(data.tagCreate);
  await globalConfig.delay();
  const editInput = settingsDialog.tagEditInput();
  await expect(editInput).toBeVisible();
  await editInput.fill(data.tagEdited);
  await editInput.press("Enter");
  await globalConfig.delay();
  await globalConfig.delay();

  // Verify edit succeeded (edit saga has no notification — check table directly)
  const tagsAfterEdit = await settingsDialog.getTagTexts();
  expect(tagsAfterEdit).toContain(data.tagEdited);
  expect(tagsAfterEdit).not.toContain(data.tagCreate);
  await verification.captureStep(testInfo, "tag-edited");

  // Step 5: DELETE — remove the tag
  await settingsDialog.deleteTag(data.tagEdited);
  await globalConfig.delay();
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  const tagsAfterDelete = await settingsDialog.getTagTexts();
  expect(tagsAfterDelete).not.toContain(data.tagEdited);
  await verification.captureStep(testInfo, "tag-deleted");

  // No cleanup needed — tag was deleted via UI

  await settingsDialog.clickOk();
  await logout.runViaDirectUrl();
  await page.close();
});
