import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { T2724Tc036Data } from "../../data/t2724/T2724Tc036Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainFixture } from "@ttt/fixtures/MainFixture";
import { PlannerPage } from "@ttt/pages/PlannerPage";
import { ProjectSettingsDialog } from "@ttt/pages/ProjectSettingsDialog";

/**
 * TC-T2724-036: Informational text on Tasks Closing tab.
 * Verifies the explanatory text (§7.4.1) is present and correct in both EN and RU.
 * EN: "Project tickets containing added values in the Info column will be
 *      automatically removed from the list on days when there are no more reports for them"
 * RU: "Тикеты проекта, содержащие добавленные значения в колонке Инфо, будут
 *      автоматически удаляться из списка в дни, когда по ним больше нет репортов"
 * The word "Info"/"Инфо" is rendered in <strong> tags.
 */
test("TC-T2724-036: Informational text on Tasks Closing tab @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc036Data.create(
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

    // Navigate to Planner Projects tab
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

    // Open Project Settings > Tasks closing tab (EN)
    await plannerPage.clickProjectSettingsIcon();
    await settingsDialog.waitForReady();
    await settingsDialog.clickTasksClosingTab();
    await globalConfig.delay();

    // Verify EN informational text is visible
    await expect(settingsDialog.infoText()).toBeVisible();
    const enText = (await settingsDialog.infoText().textContent())?.trim() ?? "";
    // Text contains <strong>Info</strong>, rendered as plain "Info" in textContent
    expect.soft(enText).toContain("Project tickets containing added values in the");
    expect.soft(enText).toContain("Info");
    expect.soft(enText).toContain("automatically removed from the list on days when there are no more reports");
    await verification.captureStep(testInfo, "en-info-text");

    // Close dialog
    await settingsDialog.clickOk();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 });
    await globalConfig.delay();

    // --- RU verification ---
    await mainFixture.ensureLanguage("RU");

    await page.goto(
      `${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`,
      { waitUntil: "networkidle" },
    );
    await globalConfig.delay();

    // selectProject uses combobox role + project name (language-independent)
    await plannerPage.selectProject(data.projectName);
    await globalConfig.delay();

    await plannerPage.clickProjectSettingsIcon();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await globalConfig.delay();

    // Click Tasks closing tab using .or() for both languages
    const tasksClosingTab = page
      .getByRole("dialog")
      .getByRole("button", { name: "Tasks closing" })
      .or(page.getByRole("dialog").getByRole("button", { name: "Закрытие задач" }));
    await tasksClosingTab.first().click();
    await globalConfig.delay();

    // Verify RU informational text
    const ruInfoText = page.getByRole("dialog").locator(".tags_text");
    await expect(ruInfoText).toBeVisible();
    const ruText = (await ruInfoText.textContent())?.trim() ?? "";
    expect.soft(ruText).toContain("Тикеты проекта");
    expect.soft(ruText).toContain("Инфо");
    expect.soft(ruText).toContain("автоматически удаляться из списка");
    await verification.captureStep(testInfo, "ru-info-text");

    // Close dialog
    await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 });
    await globalConfig.delay();

    // Restore EN
    await mainFixture.ensureLanguage("EN");
  } finally {
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
