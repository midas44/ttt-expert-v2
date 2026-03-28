import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc032Data } from "../../data/t2724/T2724Tc032Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-032: Bug 4 regression — OK button present in Tasks Closing tab.
 * Bug: OK button was missing from the Tasks closing tab. Fixed by !5313.
 * Verify OK button is visible on both tabs and closes the dialog.
 */
test("TC-T2724-032: Bug 4 regression — OK button present in Tasks Closing tab @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc032Data.create(
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

  try {
    await login.run();
    await mainFixture.ensureLanguage("EN");

    await page.goto(
      `${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`,
      { waitUntil: "domcontentloaded" },
    );
    await plannerPage.waitForReady();
    await globalConfig.delay();

    await plannerPage.selectRoleFilter("PM");
    await globalConfig.delay();
    await plannerPage.selectProject(data.projectName);
    await globalConfig.delay();

    // Open Project Settings dialog
    await plannerPage.clickProjectSettingsIcon();
    await settingsDialog.waitForReady();
    await globalConfig.delay();

    // Verify OK button on Project Members tab (default tab)
    await expect(settingsDialog.okButton()).toBeVisible();
    await verification.captureStep(testInfo, "ok-button-on-members-tab");

    // Switch to Tasks closing tab
    await settingsDialog.clickTasksClosingTab();
    await globalConfig.delay();

    // Verify OK button on Tasks closing tab
    await expect(settingsDialog.okButton()).toBeVisible();
    await expect(settingsDialog.okButton()).toBeEnabled();
    await verification.captureStep(testInfo, "ok-button-on-closing-tab");

    // Click OK — verify dialog closes
    await settingsDialog.clickOk();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 });
    await globalConfig.delay();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await verification.captureStep(testInfo, "dialog-closed-via-ok");
  } finally {
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
