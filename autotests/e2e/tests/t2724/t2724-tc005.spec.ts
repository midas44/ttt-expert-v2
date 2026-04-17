import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc005Data } from "../../data/t2724/T2724Tc005Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";
import { ProjectSettingsDialog } from "@ttt/pages/ProjectSettingsDialog";

/**
 * TC-T2724-005: Inline edit — Escape cancels without saving.
 * Verifies that pressing Escape during inline editing reverts the change.
 * No PATCH request should be sent. Original text preserved.
 */
test("TC-T2724-005: Inline edit — Escape cancels @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc005Data.create(
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
    data: { tag: data.tagValue },
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

  // Step 3: Verify original tag exists
  const tagsBefore = await settingsDialog.getTagTexts();
  expect(tagsBefore).toContain(data.tagValue);
  await verification.captureStep(testInfo, "original-tag-before-edit");

  // Step 4: Click tag to enter inline edit mode
  await settingsDialog.clickTagToEdit(data.tagValue);
  await globalConfig.delay();

  // Step 5: Modify text, then press Escape
  const editInput = settingsDialog.tagEditInput();
  await expect(editInput).toBeVisible();
  await editInput.fill("modified-value");
  await editInput.press("Escape");
  await globalConfig.delay();

  // Step 6: Verify tag text reverted to original
  const tagsAfter = await settingsDialog.getTagTexts();
  expect(tagsAfter).toContain(data.tagValue);
  expect(tagsAfter).not.toContain("modified-value");
  await verification.captureStep(testInfo, "tag-reverted-after-escape");

  // Step 7: Verify no "Changes saved" notification appeared
  const notification = page.getByText("Changes have been saved");
  await expect(notification).not.toBeVisible();

  // CLEANUP: Delete the tag via API
  const listResp = await request.get(tagsUrl, { headers });
  if (listResp.ok()) {
    const tagsList = await listResp.json();
    const tag = tagsList.find(
      (t: { tag: string }) => t.tag === data.tagValue,
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
