import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { T2724Tc031Data } from "../../data/t2724/T2724Tc031Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";
import { ProjectSettingsDialog } from "../../pages/ProjectSettingsDialog";

/**
 * TC-T2724-031: Bug 3 regression — correct column header in Tasks Closing tab.
 * Bug: column header showed "Role on the project" instead of "Tags for closing tasks".
 * Fixed by !5313. Verify in both EN and RU.
 */
test("TC-T2724-031: Bug 3 regression — correct column header in Tasks Closing tab @regress @t2724", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await T2724Tc031Data.create(
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

    // Verify EN column header
    const enHeader = await settingsDialog.getTagColumnHeaderText();
    expect.soft(enHeader).toBe("Tags for closing tasks");
    expect.soft(enHeader).not.toContain("Role on the project");
    await verification.captureStep(testInfo, "en-column-header");

    // Close dialog
    await settingsDialog.clickOk();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 });
    await globalConfig.delay();

    // --- RU verification ---
    // Switch to Russian (this may reload the page)
    await mainFixture.ensureLanguage("RU");

    // Re-navigate (PlannerPage.waitForReady/selectRoleFilter are EN-only,
    // so use language-independent approach for RU)
    await page.goto(
      `${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`,
      { waitUntil: "networkidle" },
    );
    await globalConfig.delay();

    // selectProject uses combobox role + project name (language-independent)
    await plannerPage.selectProject(data.projectName);
    await globalConfig.delay();

    // clickProjectSettingsIcon uses CSS selector (language-independent)
    await plannerPage.clickProjectSettingsIcon();
    // Wait for any dialog (without EN name filter)
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await globalConfig.delay();

    // Click Tasks closing tab using .or() for both languages
    const tasksClosingTab = page
      .getByRole("dialog")
      .getByRole("button", { name: "Tasks closing" })
      .or(page.getByRole("dialog").getByRole("button", { name: "Закрытие задач" }));
    await tasksClosingTab.first().click();
    await globalConfig.delay();

    // Read column header via table (language-independent locator)
    const ruHeader = (
      await page
        .getByRole("dialog")
        .getByRole("table")
        .locator("thead th")
        .first()
        .textContent()
    )?.trim() ?? "";
    expect.soft(ruHeader).toBe("Теги для закрытия задач");
    expect.soft(ruHeader).not.toContain("Роль на проекте");
    await verification.captureStep(testInfo, "ru-column-header");

    // Close dialog (OK text is the same in both languages)
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
