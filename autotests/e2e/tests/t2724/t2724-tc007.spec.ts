import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc007Data } from "../../data/t2724/T2724Tc007Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";
import { ProjectSettingsDialog } from "@ttt/pages/ProjectSettingsDialog";

/**
 * TC-T2724-007: Delete a tag — happy path.
 * Verifies that clicking the delete icon removes a tag immediately (no confirmation).
 * DELETE /close-tags/{tagId} is called. "Changes have been saved" notification shown.
 */
test("TC-T2724-007: Delete a tag — happy path @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc007Data.create(
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

  // SETUP: Create tag via API
  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
  const tagsUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectId}/close-tags`,
  );
  await request.post(tagsUrl, { headers, data: { tag: data.tagValue } });

  // Step 1: Login and ensure English
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

  // Step 3: Verify the tag is visible
  const tagsBefore = await settingsDialog.getTagTexts();
  expect(tagsBefore).toContain(data.tagValue);
  await verification.captureStep(testInfo, "tag-before-delete");

  // Step 4: Click the delete (trash) icon on the tag row
  await settingsDialog.deleteTag(data.tagValue);
  await globalConfig.delay();

  // Step 5: Verify "Changes have been saved" notification
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  await verification.captureStep(testInfo, "delete-notification");

  // Step 6: Verify tag is removed from the table
  const tagsAfter = await settingsDialog.getTagTexts();
  expect(tagsAfter).not.toContain(data.tagValue);
  await verification.captureStep(testInfo, "tag-removed");

  // No cleanup needed — tag already deleted via UI

  await settingsDialog.clickOk();
  await logout.runViaDirectUrl();
  await page.close();
});
