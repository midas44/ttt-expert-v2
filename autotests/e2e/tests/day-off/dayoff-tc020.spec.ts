import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc020Data } from "../../data/day-off/DayoffTc020Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffRequestPage } from "@ttt/pages/DayOffRequestPage";

/**
 * TC-DO-020: Manager rejects a day-off transfer request.
 *
 * Logs in as the manager, navigates to the approval page,
 * finds the employee's NEW request, and clicks reject.
 * Verifies the request disappears from the APPROVER tab.
 */
test("TC-DO-020: Manager rejects dayoff transfer request @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc020Data.create(
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

    // Step 3: Count total rows before reject (to verify decrease after)
    const totalBefore = await requestPage.requestRow(/./).count();

    // Step 4: Verify the employee's request row is visible
    const row = requestPage.requestRow(data.employeePattern);
    await expect(
      row.first(),
      `Should see request from ${data.employeeLogin}`,
    ).toBeVisible();

    // Step 5: Click reject
    await requestPage.clickReject(data.employeePattern);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-reject");

    // Step 6: Verify request count decreased (reload to see updated data)
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    const totalAfter = await requestPage.requestRow(/./).count();
    expect(
      totalAfter,
      "Total request count should decrease after reject",
    ).toBeLessThan(totalBefore);
    await verification.captureStep(testInfo, "request-rejected");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
