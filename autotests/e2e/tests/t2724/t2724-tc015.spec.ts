import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc015Data } from "../../data/t2724/T2724Tc015Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-015: Multiple tags — create 5+ tags for a project.
 * Verifies no max tag limit, all tags visible, each independently manageable.
 */
test("TC-T2724-015: Multiple tags — create 5+ tags @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc015Data.create(
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

  // Step 1: Login as PM, ensure English
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

  // Step 3: Create all 5 tags sequentially
  for (const tag of data.tags) {
    await settingsDialog.addTag(tag);
    await globalConfig.delay();
    await expect(page.getByText("Changes have been saved")).toBeVisible({
      timeout: 10000,
    });
  }

  // Step 4: Verify all 5 tags are visible in the table
  const allTags = await settingsDialog.getTagTexts();
  for (const tag of data.tags) {
    expect(allTags).toContain(tag);
  }
  expect(allTags.length).toBeGreaterThanOrEqual(data.tags.length);
  await verification.captureStep(testInfo, "five-tags-created");

  // Step 5: Verify one tag can be deleted independently
  const tagToDelete = data.tags[0];
  await settingsDialog.deleteTag(tagToDelete);
  await globalConfig.delay();
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  const tagsAfterDelete = await settingsDialog.getTagTexts();
  expect(tagsAfterDelete).not.toContain(tagToDelete);
  // Other 4 tags still present
  for (let i = 1; i < data.tags.length; i++) {
    expect(tagsAfterDelete).toContain(data.tags[i]);
  }
  await verification.captureStep(testInfo, "one-tag-deleted-four-remain");

  // CLEANUP: Delete remaining 4 tags via API
  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
  const tagsUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectId}/close-tags`,
  );
  const listResp = await request.get(tagsUrl, { headers });
  if (listResp.ok()) {
    const remoteTags = await listResp.json();
    for (let i = 1; i < data.tags.length; i++) {
      const found = remoteTags.find(
        (t: { tag: string }) => t.tag === data.tags[i],
      );
      if (found) {
        await request.delete(
          tttConfig.buildUrl(
            `/api/ttt/v1/projects/${data.projectId}/close-tags/${found.id}`,
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
