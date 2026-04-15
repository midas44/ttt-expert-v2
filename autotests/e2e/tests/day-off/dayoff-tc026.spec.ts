import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc026Data } from "../../data/day-off/DayoffTc026Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffRequestPage } from "@ttt/pages/DayOffRequestPage";
import { WeekendDetailsModal } from "@ttt/pages/WeekendDetailsModal";

/**
 * TC-DO-026: Remove optional approver.
 *
 * The manager opens the modal for a NEW request, adds an optional
 * approver via Edit list mode (setup), then removes it and saves.
 * Verifies the approver count drops to 0.
 */
test("TC-DO-026: Remove optional approver @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc026Data.create(
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

  const employeeLastName = data.employeeName.split(" ")[0];
  const employeePattern = new RegExp(employeeLastName, "i");

  try {
    // Step 1: Login as manager
    await login.run();

    // Step 2: Navigate to Approval tab
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Find the request row
    const row = requestPage.requestRow(employeePattern).first();
    await expect(
      row,
      `Should see request for ${employeeLastName}`,
    ).toBeVisible({ timeout: 15_000 });

    // Step 4: Open modal
    await requestPage.clickInfoOnRow(row);
    await modal.waitForOpen();
    await globalConfig.delay();

    // ── SETUP: Add an optional approver first (via UI) ─────────
    await modal.clickEditList();
    await globalConfig.delay();

    await modal.clickAddApprover();
    await globalConfig.delay();

    const searchTerm =
      data.optionalApproverName.split(" ").pop() ??
      data.optionalApproverName;
    await modal.selectApprover(searchTerm);
    await globalConfig.delay();

    // Save to persist the added approver
    const addResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("dayOff") &&
        resp.request().method() !== "GET" &&
        resp.status() < 400,
      { timeout: 15_000 },
    );
    await modal.clickSave();
    await addResponse;
    await globalConfig.delay();
    await verification.captureStep(testInfo, "approver-added");

    // Step 5: Verify optional approver is present after adding
    expect(
      await modal.isApproversTableVisible(),
      "Approvers table should be visible after adding",
    ).toBeTruthy();
    const countBefore = await modal.getApproverCount();
    expect(
      countBefore,
      "Should have at least 1 optional approver",
    ).toBeGreaterThanOrEqual(1);

    // ── MAIN TEST: Remove the optional approver ────────────────

    // Step 6: Click Edit list to re-enter edit mode
    await modal.clickEditList();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "edit-mode-for-delete");

    // Step 7: Remove the optional approver (first row in edit mode)
    await modal.deleteApproverByIndex(0);
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-delete-click");

    // Step 8: Save changes
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
    await verification.captureStep(testInfo, "after-save");

    // Step 9: Verify approver was removed
    const hasTable = await modal.isApproversTableVisible();
    if (hasTable) {
      const countAfter = await modal.getApproverCount();
      expect(
        countAfter,
        "Approver count should be 0 after removal",
      ).toBe(0);
    }
    await verification.captureStep(testInfo, "removal-verified");

    await modal.clickClose();
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
