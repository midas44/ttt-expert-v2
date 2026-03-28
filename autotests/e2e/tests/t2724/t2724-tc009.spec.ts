import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc009Data } from "../../data/t2724/T2724Tc009Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-009: Permission — employee can list tags but cannot create.
 * Verifies that a plain project member (not PM/SPM/admin) cannot open
 * the Project Settings dialog. Even if the icon element exists in the DOM,
 * clicking it must NOT open the "Project settings" dialog.
 */
test("TC-T2724-009: Permission — employee cannot access tag management @regress @t2724", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc009Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  // SETUP: Create a tag as PM via API so the project has tags
  const headers = { API_SECRET_TOKEN: tttConfig.apiToken };
  const tagsUrl = tttConfig.buildUrl(
    `/api/ttt/v1/projects/${data.projectId}/close-tags`,
  );
  await request.post(tagsUrl, { headers, data: { tag: data.tagValue } });

  const login = new LoginFixture(
    page,
    tttConfig,
    data.memberLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);
  const settingsDialog = new ProjectSettingsDialog(page);

  // Step 1: Login as plain member and ensure English
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Planner > Projects tab
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Select the project
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "member-project-selected");

  // Step 4: Verify the settings icon is not visible OR that clicking it
  // does NOT open the Project Settings dialog.
  const iconVisible = await plannerPage.isProjectSettingsIconVisible();
  if (iconVisible) {
    // Icon present — click it and verify dialog does NOT open
    await plannerPage.clickProjectSettingsIcon();
    await globalConfig.delay();
    const dialogOpen = await settingsDialog.isVisible();
    expect(dialogOpen).toBe(false);
    await verification.captureStep(testInfo, "settings-dialog-not-opened");
  } else {
    // Icon not present — permission enforced at UI level (expected)
    await verification.captureStep(testInfo, "settings-icon-hidden");
  }

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

  await logout.runViaDirectUrl();
  await page.close();
});
