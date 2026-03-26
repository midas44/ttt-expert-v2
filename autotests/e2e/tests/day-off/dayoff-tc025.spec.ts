import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc025Data } from "../../data/day-off/DayoffTc025Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../../pages/DayOffRequestPage";
import { WeekendDetailsModal } from "../../pages/WeekendDetailsModal";

/**
 * TC-DO-025: Add optional approver via Edit list mode.
 *
 * A manager opens the modal for a NEW request on the Approval tab,
 * enters Edit list mode, adds an optional approver, and saves.
 * Edit mode disables main action buttons (Approve/Reject/Redirect).
 */
test("TC-DO-025: Add optional approver via Edit list mode @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc025Data.create(
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

  // Match by employee name to find the request row
  const employeeLastName = data.employeeName.split(" ")[0];
  const employeePattern = new RegExp(employeeLastName, "i");

  try {
    // Step 1: Login as manager
    await login.run();

    // Step 2: Navigate to Approval tab (shows only NEW requests)
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Find the NEW request row
    const row = requestPage.requestRow(employeePattern).first();
    await expect(
      row,
      `Should see NEW request for ${employeeLastName}`,
    ).toBeVisible({ timeout: 15_000 });

    // Step 4: Open modal via info button
    await requestPage.clickInfoOnRow(row);
    await modal.waitForOpen();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "modal-opened");

    // Step 5: Verify Edit list button is visible
    expect(
      await modal.isEditListVisible(),
      "Edit list button should be visible",
    ).toBeTruthy();

    // Step 6: Click Edit list — enter edit mode
    await modal.clickEditList();
    await globalConfig.delay();

    // Step 7: Verify main action buttons are disabled in edit mode
    // In edit mode the buttons may be hidden or disabled
    const approveEnabled = await modal.isApproveEnabled().catch(() => false);
    const rejectEnabled = await modal.isRejectEnabled().catch(() => false);
    expect(
      approveEnabled,
      "Approve should be disabled in edit mode",
    ).toBeFalsy();
    expect(
      rejectEnabled,
      "Reject should be disabled in edit mode",
    ).toBeFalsy();
    await verification.captureStep(testInfo, "edit-mode-active");

    // Step 8: Add an optional approver
    await modal.clickAddApprover();
    await globalConfig.delay();

    // Use the last name (more unique) to search for the approver
    const searchTerm = data.optionalApproverName.split(" ").pop() ?? data.optionalApproverName;
    await modal.selectApprover(searchTerm);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "approver-added");

    // Step 9: Save the changes
    const saveResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("dayOff") &&
        resp.request().method() !== "GET" &&
        resp.status() < 400,
      { timeout: 15_000 },
    );
    await modal.clickSave();
    await saveResponse;
    await globalConfig.delay();

    // Step 10: Verify edit mode deactivated — main buttons re-enabled
    const approveEnabledAfter = await modal.isApproveEnabled().catch(() => false);
    expect(
      approveEnabledAfter,
      "Approve should be re-enabled after save",
    ).toBeTruthy();
    await verification.captureStep(testInfo, "edit-mode-saved");

    // Step 11: Verify the added approver appears in the approvers table
    expect(
      await modal.isApproversTableVisible(),
      "Approvers table should be visible",
    ).toBeTruthy();
    const approverCount = await modal.getApproverCount();
    expect(
      approverCount,
      "Should have at least one optional approver",
    ).toBeGreaterThanOrEqual(1);

    await verification.captureStep(testInfo, "optional-approver-verified");
    await modal.clickClose();
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
