import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc002Data } from "../../data/t2724/T2724Tc002Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-002: Create duplicate tag — idempotent behavior.
 * Verifies that creating a tag that already exists does not produce a duplicate.
 * Backend catches DataIntegrityViolationException and returns existing entity.
 */
test("TC-T2724-002: Create duplicate tag — idempotent @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc002Data.create(
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

  // SETUP: Create tag via API first
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

  // Step 2: Navigate to Planner > Projects > select project > Settings > Tasks closing
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

  // Step 3: Verify the tag already exists
  const tagsBefore = await settingsDialog.getTagTexts();
  const countBefore = tagsBefore.filter((t) => t === data.tagValue).length;
  expect(countBefore).toBe(1);
  await verification.captureStep(testInfo, "tag-exists-before");

  // Step 4-5: Try to create the same tag again
  await settingsDialog.addTag(data.tagValue);
  await globalConfig.delay();

  // Step 6: Verify no duplicate — still only one instance
  const tagsAfter = await settingsDialog.getTagTexts();
  const countAfter = tagsAfter.filter((t) => t === data.tagValue).length;
  expect(countAfter).toBe(1);
  await verification.captureStep(testInfo, "no-duplicate-after");

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
