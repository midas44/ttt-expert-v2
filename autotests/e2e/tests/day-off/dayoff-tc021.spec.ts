import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc021Data } from "../../data/day-off/DayoffTc021Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../../pages/DayOffRequestPage";
import { RedirectDialog } from "../../pages/RedirectDialog";

/**
 * TC-DO-021: Manager redirects a day-off transfer request to another manager.
 *
 * Logs in as the original manager, navigates to the approval page,
 * clicks redirect on the employee's request, selects a target manager
 * from the dialog, and confirms. Verifies the request disappears
 * from the original manager's APPROVER tab.
 */
test("TC-DO-021: Manager redirects dayoff request to another manager @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc021Data.create(
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
  const redirectDialog = new RedirectDialog(page);

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

    // Step 4: Click redirect on the request row
    await requestPage.clickRedirect(data.employeePattern);
    await globalConfig.delay();

    // Step 5: Verify redirect dialog opens
    await redirectDialog.waitForOpen();
    await verification.captureStep(testInfo, "redirect-dialog-open");

    // Step 6: Select the target manager
    await redirectDialog.selectManager(data.targetManagerFullName);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "manager-selected");

    // Step 7: Click OK to confirm redirect
    await redirectDialog.clickOk();
    await globalConfig.delay();
    await redirectDialog.waitForClose();

    // Step 8: Verify the request disappears from the original manager's APPROVER tab
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    const rowAfter = requestPage.requestRow(data.employeePattern);
    const rowCount = await rowAfter.count();
    expect(
      rowCount,
      "Redirected request should disappear from original manager's APPROVER tab",
    ).toBe(0);
    await verification.captureStep(testInfo, "request-redirected");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
