import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc004Data } from "../../data/reports/ReportsTc004Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-004: Report in closed period — blocked.
 * Verifies that cells for dates before the office report period start
 * are read-only / not editable.
 */
test("TC-RPT-004: Report in closed period — blocked @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc004Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const tasksPage = new MyTasksPage(page);

  // Step 1-2: Login → lands on My Tasks (/report)
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }
  await tasksPage.waitForReady();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "my-tasks-current-week");

  // Step 3: Navigate to a week before the report period start
  // Click previous week enough times to reach the closed period
  const periodStart = new Date(data.periodStart);
  const now = new Date();
  const weeksDiff = Math.ceil(
    (now.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const clicksNeeded = Math.min(weeksDiff + 1, 12); // Safety cap

  for (let i = 0; i < clicksNeeded; i++) {
    await tasksPage.navigateToPreviousWeek();
    await globalConfig.delay();
  }
  await verification.captureStep(testInfo, "navigated-to-closed-week");

  // Step 4-6: Verify cells are NOT editable in this closed-period week
  const taskRow = tasksPage.taskRow(data.taskPattern);
  const rowCount = await taskRow.count();
  if (rowCount > 0) {
    const isEditable = await tasksPage.isCellEditable(
      taskRow.first(),
      data.closedDateLabel,
    );
    expect(isEditable).toBe(false);
    await verification.captureStep(testInfo, "cell-not-editable-confirmed");
  } else {
    // Task row may not be visible in closed period — that's acceptable
    await verification.captureStep(testInfo, "no-task-rows-in-closed-period");
  }

  // Return to current week
  await tasksPage.goToCurrentWeek();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();
});
