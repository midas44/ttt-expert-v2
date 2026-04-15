import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc019Data } from "../../data/day-off/DayoffTc019Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffRequestPage } from "@ttt/pages/DayOffRequestPage";
import { WeekendDetailsModal } from "@ttt/pages/WeekendDetailsModal";

/**
 * TC-DO-019: Approve transfer request via modal button.
 *
 * Manager opens the WeekendDetailsModal for a NEW request,
 * clicks the Approve button inside the modal, and verifies
 * the request gets approved.
 */
test("TC-DO-019: Approve transfer request via modal button @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc019Data.create(
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
  const modal = new WeekendDetailsModal(page);

  try {
    // Step 1: Login as manager
    await login.run();

    // Step 2: Navigate to the dayoff approval page
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Verify the employee's request is visible before approval
    const row = requestPage.requestRow(data.employeePattern);
    await expect(row.first()).toBeVisible();

    // Step 4: Click info to open modal
    await requestPage.clickInfo(data.employeePattern);
    await modal.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "modal-opened");

    // Step 5: Verify Approve button is visible and enabled
    expect(
      await modal.isApproveVisible(),
      "Approve button should be visible in modal",
    ).toBeTruthy();

    // Step 6: Click Approve inside the modal, wait for API response
    const approveResponse = page.waitForResponse(
      (resp) => resp.url().includes("dayOff") && resp.status() < 400,
      { timeout: 15_000 },
    );
    await modal.clickApprove();
    await approveResponse;

    // Step 7: Modal should close after successful approval
    await modal.waitForClose();
    await verification.captureStep(testInfo, "after-modal-approve");

    // Step 8: Reload and verify the approved request is gone from Approval tab
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    // The Approval tab only shows NEW requests — approved one should be gone
    await expect(
      requestPage.requestRow(data.employeePattern).first(),
    ).not.toBeVisible({ timeout: 10_000 });
    await verification.captureStep(testInfo, "request-approved-via-modal");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
