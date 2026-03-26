import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc027Data } from "../data/DayoffTc027Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffRequestPage } from "../pages/DayOffRequestPage";
import { WeekendDetailsModal } from "../pages/WeekendDetailsModal";

/**
 * TC-DO-027: Main action buttons disabled during Edit list mode.
 *
 * Manager opens the WeekendDetailsModal, verifies action buttons are enabled,
 * clicks "Edit list", verifies they become disabled, clicks Cancel,
 * and verifies they re-enable.
 */
test("TC-DO-027: Action buttons disabled during Edit list mode @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc027Data.create(
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

    // Step 2: Navigate to approval page and open modal
    await requestPage.goto(tttConfig.appUrl);
    await requestPage.waitForReady();
    await globalConfig.delay();

    await requestPage.clickInfo(data.employeePattern);
    await modal.waitForOpen();
    await globalConfig.delay();

    // Step 3: Verify action buttons are ENABLED before edit mode
    expect(
      await modal.isApproveEnabled(),
      "Approve should be enabled before Edit list",
    ).toBeTruthy();
    expect(
      await modal.isRejectEnabled(),
      "Reject should be enabled before Edit list",
    ).toBeTruthy();
    expect(
      await modal.isRedirectEnabled(),
      "Redirect should be enabled before Edit list",
    ).toBeTruthy();
    await verification.captureStep(testInfo, "buttons-enabled-before-edit");

    // Step 4: Click "Edit list" to enter edit mode
    await modal.clickEditList();
    await globalConfig.delay();

    // Step 5: Verify action buttons become DISABLED
    expect(
      await modal.isApproveEnabled(),
      "Approve should be DISABLED during Edit list",
    ).toBeFalsy();
    expect(
      await modal.isRejectEnabled(),
      "Reject should be DISABLED during Edit list",
    ).toBeFalsy();
    expect(
      await modal.isRedirectEnabled(),
      "Redirect should be DISABLED during Edit list",
    ).toBeFalsy();
    await verification.captureStep(testInfo, "buttons-disabled-during-edit");

    // Step 6: Click Cancel to exit edit mode
    await modal.clickCancelEdit();
    await globalConfig.delay();

    // Step 7: Verify action buttons are ENABLED again
    expect(
      await modal.isApproveEnabled(),
      "Approve should re-enable after Cancel",
    ).toBeTruthy();
    expect(
      await modal.isRejectEnabled(),
      "Reject should re-enable after Cancel",
    ).toBeTruthy();
    expect(
      await modal.isRedirectEnabled(),
      "Redirect should re-enable after Cancel",
    ).toBeTruthy();
    await verification.captureStep(testInfo, "buttons-re-enabled-after-cancel");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
