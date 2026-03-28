import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc017Data } from "../../data/planner/PlannerTc017Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-017: 'Open for editing' generates assignments for employee.
 * Verifies that clicking per-employee "Open for editing" on the Projects tab
 * generates task assignments with DnD handles and editable cells.
 */
test("TC-PLN-017: Open for editing generates assignments @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc017Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Login as PM, ensure EN, navigate to planner Projects tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_PROJECT`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Switch role filter to include PM projects — default "Member" may not show managed projects
  await plannerPage.selectRoleFilter("PM");
  await globalConfig.delay();

  // Select the project (PM manages this one, confirmed by DB query with members)
  await plannerPage.selectProject(data.projectName);
  await globalConfig.delay();
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Navigate backward through recent weekdays to find a date with "Open for editing"
  // The button only appears for employees who haven't been opened for that date
  let openBtns = page.getByRole("button", { name: "Open for editing" });
  let openBtnCount = await openBtns.count();

  // Try up to 21 days backward to find a date with readOnly employees
  for (let dayAttempt = 0; dayAttempt < 21 && openBtnCount === 0; dayAttempt++) {
    await plannerPage.navigateDateBackward();
    await globalConfig.delay();
    openBtnCount = await openBtns.count();
  }

  await verification.captureStep(testInfo, "project-selected");

  if (openBtnCount === 0) {
    test.skip(true, "No readOnly employees found on any recent date");
    return;
  }

  // Click the first "Open for editing" button
  const targetBtn = openBtns.first();
  await expect(targetBtn).toBeVisible();
  await targetBtn.click();

  // Wait for assignments to generate — button should disappear or change
  await expect(targetBtn).toBeHidden({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  await verification.captureStep(testInfo, "editing-opened");

  // Verify DnD handles ("::" buttons) appeared in the table
  const dndHandles = page.getByRole("button", { name: "::" });
  const handleCount = await dndHandles.count();
  expect(handleCount).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "dnd-handles-visible");

  // Verify that task rows appeared under the employee
  // Use the planner's data table to find actual task rows (not calendar/datepicker rows)
  const dataRows = plannerPage.dataTableRows();
  const dataRowCount = await dataRows.count();
  expect(dataRowCount).toBeGreaterThan(0);
  await verification.captureStep(testInfo, "cells-editable");

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
