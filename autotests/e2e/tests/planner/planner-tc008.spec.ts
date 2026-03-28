import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { PlannerTc008Data } from "../../data/planner/PlannerTc008Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainFixture } from "../../fixtures/MainFixture";
import { PlannerPage } from "../../pages/PlannerPage";

/**
 * TC-PLN-008: Collapse and expand project groups in Tasks tab.
 * Verifies that project group headers can be collapsed/expanded
 * and that the Total row still shows the correct sum.
 */
test("TC-PLN-008: Collapse and expand project groups @regress @planner", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await PlannerTc008Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const plannerPage = new PlannerPage(page);

  // Step 0: Login, ensure EN, go to planner Tasks tab
  await login.run();
  await mainFixture.ensureLanguage("EN");
  await page.goto(`${tttConfig.appUrl}/planner/TABS_ASSIGNMENTS_TASK`, {
    waitUntil: "domcontentloaded",
  });
  await plannerPage.waitForReady();
  await globalConfig.delay();

  // Navigate backward 1 day to a workday (to ensure assignments are visible)
  await plannerPage.navigateDateBackward();
  await globalConfig.delay();

  // Step 1: Verify multiple project group headers are visible
  const groupCount = await plannerPage.projectGroupRows().count();
  expect(groupCount).toBeGreaterThanOrEqual(2);
  await verification.captureStep(testInfo, "multiple-groups-visible");

  // Step 2: Count total visible table rows before collapse
  const rowsBefore = await page.locator("table tbody tr").count();

  // Step 3: Note the Total row text before collapse
  const totalBefore = await plannerPage.totalRow().textContent();

  // Step 4: Collapse the first project group
  await plannerPage.clickExpandButton(0);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "group-collapsed");

  // Step 5: Verify fewer rows are visible (tasks under first group are hidden)
  const rowsAfter = await page.locator("table tbody tr").count();
  expect(rowsAfter).toBeLessThan(rowsBefore);

  // Step 6: Verify Total row still shows the same value (includes hidden tasks)
  const totalAfter = await plannerPage.totalRow().textContent();
  expect(totalAfter).toBe(totalBefore);

  // Step 7: Expand the first project group again
  await plannerPage.clickExpandButton(0);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "group-expanded");

  // Step 8: Verify rows are restored
  const rowsRestored = await page.locator("table tbody tr").count();
  expect(rowsRestored).toBe(rowsBefore);

  // Logout and close
  await logout.runViaDirectUrl();
  await page.close();
});
