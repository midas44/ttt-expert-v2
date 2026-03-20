import { test } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { ReportTc1Data } from "../data/ReportTc1Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { PageReloadFixture } from "../fixtures/PageReloadFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { TaskReportingFixture } from "../fixtures/TaskReportingFixture";

test("report_tc1 - add task report via inline editor and clear it @regress", async ({ page }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportTc1Data.create(globalConfig.testDataMode, tttConfig);

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // 3. Fixtures
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const reporting = new TaskReportingFixture(page, globalConfig, verification);
  const reload = new PageReloadFixture(page, tttConfig, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Sign in
  await login.run();

  // Step 2: Ensure English
  await mainFixture.ensureLanguage("EN");

  // Step 3: Confirm "My tasks" page is displayed (dashboard = /report)
  await reporting.ensureReady();
  await verification.verifyLocatorVisible(
    page.locator("input[name='TASK_NAME'], input.react-autosuggest__input").first(),
    testInfo,
    "my-tasks-page-loaded",
  );

  // Step 4-6: Search for task, add it, verify it appears
  const row = await reporting.addTaskFromSearch(
    data.searchTerm,
    data.rowPattern,
    testInfo,
  );

  // Step 7-8: Double-click day cell, enter report value, exit editing
  await reporting.fillReportValue(row, data.dateLabel, data.reportValue, testInfo, {
    verify: false,
  });

  // Step 9: Reload and verify value persists
  await reload.reload();
  await reporting.verifyReportValue(
    data.rowPattern,
    data.dateLabel,
    data.reportValue,
    testInfo,
  );

  // Step 10-11: Double-click same cell, clear it, exit editing
  const rowAfterReload = await reporting.getTaskRow(data.rowPattern);
  await reporting.clearReportValue(rowAfterReload, data.dateLabel, testInfo, {
    verify: false,
  });

  // Step 12-13: Reload and verify cell is empty
  await reload.reload();
  await reporting.verifyReportEmpty(
    data.rowPattern,
    data.dateLabel,
    testInfo,
  );

  // Step 14-15: Clear search field and verify it's empty
  await reporting.clearSearch();
  await reporting.verifySearchEmpty(testInfo);

  // Step 16-17: Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
