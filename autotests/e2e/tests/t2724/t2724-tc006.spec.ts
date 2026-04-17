import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc006Data } from "../../data/t2724/T2724Tc006Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";
import { ProjectSettingsDialog } from "@ttt/pages/ProjectSettingsDialog";

/**
 * TC-T2724-006: Edit tag to duplicate value — validation error.
 * Verifies that editing a tag to match an existing tag is rejected.
 * Backend throws ValidationException: "Planner close tag already exists for project".
 */
test("TC-T2724-006: Edit tag to duplicate value — validation error @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc006Data.create(
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

  // SETUP: Create both tags via API
  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
  const tagsUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectId}/close-tags`,
  );
  await request.post(tagsUrl, { headers, data: { tag: data.tagA } });
  await request.post(tagsUrl, { headers, data: { tag: data.tagB } });

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

  // Verify both tags exist
  const tagsBefore = await settingsDialog.getTagTexts();
  expect(tagsBefore).toContain(data.tagA);
  expect(tagsBefore).toContain(data.tagB);
  await verification.captureStep(testInfo, "both-tags-before");

  // Step 3: Click tag-b to enter inline edit mode
  await settingsDialog.clickTagToEdit(data.tagB);
  await globalConfig.delay();

  // Step 4-5: Change text to match tag-a and press Enter
  const editInput = settingsDialog.tagEditInput();
  await expect(editInput).toBeVisible();
  await editInput.fill(data.tagA);
  await editInput.press("Enter");
  await globalConfig.delay();
  await globalConfig.delay();

  // Step 6: Verify tag-b remains unchanged (edit rejected)
  const tagsAfter = await settingsDialog.getTagTexts();
  const tagACount = tagsAfter.filter((t) => t === data.tagA).length;
  expect(tagACount).toBe(1); // Only one instance of tag-a — no duplicate
  expect(tagsAfter).toContain(data.tagB); // tag-b still present with original value
  await verification.captureStep(testInfo, "duplicate-edit-rejected");

  // CLEANUP: Delete both tags via API
  const listResp = await request.get(tagsUrl, { headers });
  if (listResp.ok()) {
    const tagsList = await listResp.json();
    for (const t of tagsList) {
      if (t.tag === data.tagA || t.tag === data.tagB) {
        await request.delete(
          tttConfig.buildUrl(
            `/api/ttt/v1/projects/${data.projectId}/close-tags/${t.id}`,
          ),
          { headers },
        );
      }
    }
  }

  await settingsDialog.clickOk();
  await logout.runViaDirectUrl();
  await page.close();
});
