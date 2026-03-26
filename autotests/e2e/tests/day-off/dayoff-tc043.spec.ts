import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc043Data } from "../../data/day-off/DayoffTc043Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../../pages/DayOffRequestPage";

/**
 * TC-DO-043: APPROVER search type — requests pending my approval.
 *
 * Logs in as a manager, navigates to the Days off rescheduling Approval tab,
 * and verifies that a subordinate's NEW transfer request appears in the list
 * with approve/reject action buttons.
 */
test("TC-DO-043: APPROVER search type — requests pending my approval @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc043Data.create(
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

    // Step 2: Navigate to the Approval tab
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "approval-tab-loaded");

    // Step 3: Verify the subordinate's request appears
    const rowCount = await requestPage.getRowCount();
    expect(rowCount, "Approval tab should have at least one request").toBeGreaterThan(0);

    // Step 4: Find the row matching the subordinate's name
    const row = requestPage.requestRow(data.employeeName);
    await expect(
      row.first(),
      `Request from ${data.employeeName} should be visible`,
    ).toBeVisible({ timeout: 10000 });
    await verification.captureStep(testInfo, "subordinate-request-found");

    // Step 5: Verify approve/reject buttons are present
    const hasApprove = await requestPage.hasApproveButton(data.employeeName);
    expect(hasApprove, "Approve button should be present on NEW request").toBe(
      true,
    );

    const hasReject = await requestPage.hasRejectButton(data.employeeName);
    expect(hasReject, "Reject button should be present on NEW request").toBe(
      true,
    );
    await verification.captureStep(testInfo, "action-buttons-present");
  } finally {
    await DayoffTc043Data.cleanup(
      data.requestId,
      data.createdByTest,
      tttConfig,
    );
    await logout.runViaDirectUrl();
    await page.close();
  }
});
