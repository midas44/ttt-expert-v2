import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc001Data } from "../../data/t2724/T2724Tc001Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-001: Create a close tag — happy path.
 * Verifies that a PM can create a close tag via the Project Settings > Tasks closing tab.
 * Expected: tag appears in table, "Changes saved" notification shown.
 */
test("TC-T2724-001: Create a close tag — happy path @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc001Data.create(
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

  // Step 1: Login and ensure English
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Planner > Projects tab
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Select the project
  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();

  // Step 4: Click the Project Settings icon
  await plannerPage.clickProjectSettingsIcon();
  await settingsDialog.waitForReady();
  await verification.captureStep(testInfo, "settings-modal-opened");

  // Step 5: Click Tasks closing tab
  await settingsDialog.clickTasksClosingTab();
  await globalConfig.delay();

  // Step 6-7: Type tag and click add
  await settingsDialog.addTag(data.tagValue);
  await globalConfig.delay();

  // Step 8: Verify "Changes saved" notification
  await expect(page.getByText("Changes have been saved")).toBeVisible({ timeout: 10000 });
  await verification.captureStep(testInfo, "tag-created-notification");

  // Step 9: Verify tag appears in the table
  const tags = await settingsDialog.getTagTexts();
  expect(tags).toContain(data.tagValue);
  await verification.captureStep(testInfo, "tag-in-table");

  // CLEANUP: Delete the created tag via API
  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
  const listUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectId}/close-tags`,
  );
  const listResp = await request.get(listUrl, { headers });
  if (listResp.ok()) {
    const tagsList = await listResp.json();
    const created = tagsList.find(
      (t: { tag: string }) => t.tag === data.tagValue,
    );
    if (created) {
      await request.delete(
        tttConfig.buildUrl(
          `/api/ttt/v1/projects/${data.projectId}/close-tags/${created.id}`,
        ),
        { headers },
      );
    }
  }

  // Close dialog and logout
  await settingsDialog.clickOk();
  await logout.runViaDirectUrl();
  await page.close();
});
