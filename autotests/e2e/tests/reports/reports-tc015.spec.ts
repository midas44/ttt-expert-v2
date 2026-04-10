import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { ReportsTc015Data } from "../../data/reports/ReportsTc015Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";

/**
 * TC-RPT-015: Contractor report page — spinner bug (regression #3150).
 * Verifies that navigating directly to /report/<contractor_login>
 * as an admin does NOT produce an infinite spinner or global error.
 */
test("TC-RPT-015: Contractor report page — spinner bug (regression #3150) @regress @reports", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await ReportsTc015Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.adminLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Collect console errors to detect global error
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // Step 1: Login as admin
  await login.run();

  // Step 2: Navigate directly to the contractor's report page
  const reportUrl = `${tttConfig.baseUrl}/report/${data.contractorLogin}`;
  await page.goto(reportUrl);
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 3: Verify no infinite spinner — page should have loaded
  // Check that a spinner (if any) is not still visible after load
  const spinner = page.locator("[class*='spinner'], [class*='loading']");
  const spinnerVisible = await spinner
    .first()
    .isVisible()
    .catch(() => false);
  if (spinnerVisible) {
    // Wait a bit more — spinner should disappear
    await page.waitForTimeout(5000);
    const stillSpinning = await spinner
      .first()
      .isVisible()
      .catch(() => false);
    expect(stillSpinning).toBe(false);
  }
  await verification.captureStep(testInfo, "contractor-page-loaded");

  // Step 4: Verify page content is present (table or some content, not blank)
  const bodyText = await page.textContent("body");
  expect(bodyText?.length).toBeGreaterThan(50);

  // Step 5: Check no global error in console
  const criticalErrors = consoleErrors.filter(
    (e) => e.includes("global error") || e.includes("Uncaught"),
  );
  expect(criticalErrors).toHaveLength(0);
  await verification.captureStep(testInfo, "no-errors-detected");

  await logout.runViaDirectUrl();
  await page.close();
});
