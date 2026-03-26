import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc022Data } from "../data/DayoffTc022Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../pages/DayOffRequestPage";

/**
 * TC-DO-022: Action buttons on NEW request — all 4 visible.
 *
 * Verifies that a NEW dayoff request row shows all 4 action buttons:
 * approve (checkmark), reject (X), redirect (arrow), info (i).
 */
test("TC-DO-022: All 4 action buttons visible on NEW request @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc022Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const requestPage = new DayOffRequestPage(page);

  try {
    // Step 1: Login as manager
    await login.run();

    // Step 2: Navigate to the dayoff approval page
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "approval-page-loaded");

    // Step 3: Verify the employee's request row is visible
    const row = requestPage.requestRow(data.employeePattern);
    await expect(
      row.first(),
      `Should see request from ${data.employeeLogin}`,
    ).toBeVisible();

    // Step 4: Verify all 4 action buttons exist
    const hasApprove = await requestPage.hasApproveButton(data.employeePattern);
    const hasReject = await requestPage.hasRejectButton(data.employeePattern);
    const hasRedirect = await requestPage.hasRedirectButton(data.employeePattern);
    const hasInfo = await requestPage.hasInfoButton(data.employeePattern);

    expect(hasApprove, "Approve button should be present").toBeTruthy();
    expect(hasReject, "Reject button should be present").toBeTruthy();
    expect(hasRedirect, "Redirect button should be present").toBeTruthy();
    expect(hasInfo, "Info button should be present").toBeTruthy();

    await verification.captureStep(testInfo, "all-4-buttons-visible");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
