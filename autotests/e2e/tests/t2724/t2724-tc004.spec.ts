import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc004Data } from "../../data/t2724/T2724Tc004Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-004: Inline edit a tag — happy path.
 * Verifies that clicking a tag enables inline editing, and Enter saves the change.
 * PATCH /close-tags/{tagId} is called on save.
 */
test("TC-T2724-004: Inline edit tag — happy path @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc004Data.create(
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

  // SETUP: Create a tag via API
  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
  const tagsUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectId}/close-tags`,
  );
  await request.post(tagsUrl, {
    headers,
    data: { tag: data.originalTag },
  });

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

  // Step 3: Verify the original tag is visible
  const tagsBefore = await settingsDialog.getTagTexts();
  expect(tagsBefore).toContain(data.originalTag);
  await verification.captureStep(testInfo, "original-tag-visible");

  // Step 4: Click the tag text to enter inline edit mode
  await settingsDialog.clickTagToEdit(data.originalTag);
  await globalConfig.delay();

  // Step 5: Change text and press Enter
  const editInput = settingsDialog.tagEditInput();
  await expect(editInput).toBeVisible();
  await editInput.fill(data.updatedTag);
  await editInput.press("Enter");
  await globalConfig.delay();

  // Step 6: Wait for tag list to refresh (edit doesn't show a notification)
  await globalConfig.delay();

  // Step 7: Verify updated tag in table
  const tagsAfter = await settingsDialog.getTagTexts();
  expect(tagsAfter).toContain(data.updatedTag);
  expect(tagsAfter).not.toContain(data.originalTag);
  await verification.captureStep(testInfo, "tag-updated-in-table");

  // CLEANUP: Delete the tag via API
  const listResp = await request.get(tagsUrl, { headers });
  if (listResp.ok()) {
    const tagsList = await listResp.json();
    const tag = tagsList.find(
      (t: { tag: string }) => t.tag === data.updatedTag,
    );
    if (tag) {
      await request.delete(
        tttConfig.buildUrl(
          `/api/ttt/v1/projects/${data.projectId}/close-tags/${tag.id}`,
        ),
        { headers },
      );
    }
  }

  await settingsDialog.clickOk();
  await logout.runViaDirectUrl();
  await page.close();
});
