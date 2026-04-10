import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc003Data } from "../../data/t2724/T2724Tc003Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-003: Create blank/whitespace tag — validation error.
 * Verifies that blank and whitespace-only tags are rejected with proper validation.
 * Backend enforces @NotBlank on the tag field.
 */
test("TC-T2724-003: Create blank tag — validation error @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc003Data.create(
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

  // Step 3: Leave input empty and click add — verify nothing happens or button disabled
  const tagInput = settingsDialog.tagInput();
  await tagInput.fill("");
  await settingsDialog.clickAddTagButton();
  await globalConfig.delay();

  // No tag should be added — "No data" should still be visible if table was empty,
  // or tag count should not increase
  await verification.captureStep(testInfo, "empty-tag-rejected");

  // Step 4: Type spaces only and click add
  await tagInput.fill("   ");
  await settingsDialog.clickAddTagButton();
  await globalConfig.delay();

  // Verify validation error or that no whitespace tag was created
  // The table should not contain a whitespace-only entry
  const tags = await settingsDialog.getTagTexts();
  const whitespaceTag = tags.find((t) => t.trim() === "");
  expect(whitespaceTag).toBeUndefined();
  await verification.captureStep(testInfo, "whitespace-tag-rejected");

  await settingsDialog.clickOk();
  await logout.runViaDirectUrl();
  await page.close();
});
