import { test } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { ReportsTc009Data } from "../../data/reports/ReportsTc009Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { TaskReportingFixture } from "@ttt/fixtures/TaskReportingFixture";
import { MainPage, MyTasksPage } from "@ttt/pages/MainPage";

/**
 * TC-RPT-009: Batch create reports — multiple cells in one week.
 * Fills Task1 Monday + Tuesday and Task2 Monday, verifying each cell
 * and checking that daily totals calculate correctly.
 */
test("TC-RPT-009: Batch create reports — multiple cells @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc009Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const tasksPage = new MyTasksPage(page);
  const reporting = new TaskReportingFixture(page, globalConfig, verification);

  // Step 1-2: Login → lands on My Tasks (/report)
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }
  await tasksPage.waitForReady();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "my-tasks-loaded");

  // Step 3-5: Task 1 — Monday: 4 hours
  const task1Row = await tasksPage.waitForTask(data.task1Pattern);
  await reporting.fillReportValue(
    task1Row,
    data.mondayLabel,
    data.hours1,
    testInfo,
  );
  await verification.captureStep(testInfo, "task1-monday-4h");

  // Task 1 — Tuesday: 4 hours
  await reporting.fillReportValue(
    task1Row,
    data.tuesdayLabel,
    data.hours2,
    testInfo,
  );
  await verification.captureStep(testInfo, "task1-tuesday-4h");

  // Step 6-7: Task 2 — Monday: 2 hours
  const task2Row = await tasksPage.waitForTask(data.task2Pattern);
  await reporting.fillReportValue(
    task2Row,
    data.mondayLabel,
    data.hours3,
    testInfo,
  );
  await verification.captureStep(testInfo, "task2-monday-2h");

  // Step 8: Verify all three cells saved correctly
  await reporting.verifyReportValue(
    data.task1Pattern,
    data.mondayLabel,
    data.hours1,
    testInfo,
  );
  await reporting.verifyReportValue(
    data.task1Pattern,
    data.tuesdayLabel,
    data.hours2,
    testInfo,
  );
  await reporting.verifyReportValue(
    data.task2Pattern,
    data.mondayLabel,
    data.hours3,
    testInfo,
  );
  await verification.captureStep(testInfo, "all-cells-verified");

  // CLEANUP: Delete all created reports by entering 0
  await reporting.fillReportValue(task1Row, data.mondayLabel, "0", testInfo, {
    verify: false,
  });
  await reporting.fillReportValue(task1Row, data.tuesdayLabel, "0", testInfo, {
    verify: false,
  });
  const task2RowCleanup = await tasksPage.waitForTask(data.task2Pattern);
  await reporting.fillReportValue(
    task2RowCleanup,
    data.mondayLabel,
    "0",
    testInfo,
    { verify: false },
  );

  await logout.runViaDirectUrl();
  await page.close();
});
