import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc013Data } from "../../data/t2724/T2724Tc013Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-013: Special characters in tag — Unicode, Cyrillic.
 * Creates tags with non-ASCII text and verifies they are stored as-is.
 */
test("TC-T2724-013: Special characters in tag — Unicode, Cyrillic @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc013Data.create(
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

  // Step 3: Create Unicode tag
  await settingsDialog.addTag(data.tagUnicode);
  await globalConfig.delay();
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  let tags = await settingsDialog.getTagTexts();
  expect(tags).toContain(data.tagUnicode);
  await verification.captureStep(testInfo, "unicode-tag-created");

  // Step 4: Create Cyrillic tag
  await settingsDialog.addTag(data.tagCyrillic);
  await globalConfig.delay();
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  tags = await settingsDialog.getTagTexts();
  expect(tags).toContain(data.tagCyrillic);
  await verification.captureStep(testInfo, "cyrillic-tag-created");

  // Step 5: Create XSS-like tag (HTML chars)
  await settingsDialog.addTag(data.tagXss);
  await globalConfig.delay();
  await expect(page.getByText("Changes have been saved")).toBeVisible({
    timeout: 10000,
  });
  tags = await settingsDialog.getTagTexts();
  expect(tags).toContain(data.tagXss);
  await verification.captureStep(testInfo, "xss-tag-created");

  // Step 6: Verify all three tags visible in table
  expect(tags).toContain(data.tagUnicode);
  expect(tags).toContain(data.tagCyrillic);
  expect(tags).toContain(data.tagXss);

  // CLEANUP: Delete all created tags via API
  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
  const tagsUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectId}/close-tags`,
  );
  const listResp = await request.get(tagsUrl, { headers });
  if (listResp.ok()) {
    const allTags = await listResp.json();
    for (const tagVal of [data.tagUnicode, data.tagCyrillic, data.tagXss]) {
      const found = allTags.find((t: { tag: string }) => t.tag === tagVal);
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
