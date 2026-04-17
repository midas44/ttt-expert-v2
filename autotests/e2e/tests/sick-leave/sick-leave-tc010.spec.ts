import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { SickLeaveSetupData } from "../../data/sick-leave/SickLeaveSetupData";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { MySickLeavePage } from "@ttt/pages/MySickLeavePage";

/**
 * TC-SL-010: Delete sick leave (OPEN, accounting=NEW).
 * Setup: create a sick leave via UI, then delete it via the delete action button.
 * Expected: sick leave soft-deleted (status=DELETED), row disappears from active list.
 */
test("TC-SL-010: Delete sick leave @regress @sick-leave", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc010Data",
    12,
    3,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const sickLeavePage = new MySickLeavePage(page);

  try {
    // Login and set language
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Navigate to sick leave page
    await page.goto(`${tttConfig.appUrl}/sick-leave/my`, {
      waitUntil: "domcontentloaded",
    });
    await sickLeavePage.waitForReady();
    await globalConfig.delay();

    // SETUP: Create a sick leave via UI
    const dialog = await sickLeavePage.openCreateDialog();
    await dialog.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();
    await dialog.submit();
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Verify row exists
    const row = await sickLeavePage.waitForRow(data.periodPattern, 15000);
    await expect(row).toBeVisible();
    await verification.captureStep(testInfo, "sick-leave-created-for-delete");

    // Step 4: Open details dialog (click dates cell or detail icon)
    await sickLeavePage.clickDetails(data.periodPattern);
    await globalConfig.delay();

    // Wait for the details dialog (uses rc-dialog, not role="dialog")
    const detailsDialog = page.locator(".rc-dialog-wrap, [role='dialog']").first();
    await detailsDialog.waitFor({ state: "visible", timeout: 5000 });
    await verification.captureStep(testInfo, "details-dialog-before-delete");

    // Step 4b: Find and click Delete button inside the details dialog
    const deleteButton = detailsDialog.getByRole("button", { name: /delete/i })
      .or(detailsDialog.locator("button").filter({ hasText: /delete/i }));
    await deleteButton.first().click();
    await globalConfig.delay();

    // Step 5: Confirm deletion — a second dialog may appear
    // The details dialog might close and a confirmation dialog appears
    await page.waitForTimeout(1000);
    const confirmDialog = page.locator(".rc-dialog-wrap, [role='dialog']").last();
    const hasConfirm = await confirmDialog.getByRole("button", { name: /delete|confirm|yes|ok/i }).count();
    if (hasConfirm > 0) {
      await verification.captureStep(testInfo, "delete-confirmation-dialog");
      await confirmDialog.getByRole("button", { name: /delete|confirm|yes|ok/i }).first().click();
      await globalConfig.delay();
    }

    // Wait for dialogs to close
    await page.waitForTimeout(2000);

    // Refresh the page to verify
    await page.reload({ waitUntil: "domcontentloaded" });
    await sickLeavePage.waitForReady();
    await globalConfig.delay();

    // Step 6: Verify sick leave disappears from active list or shows Deleted state
    const rowVisible = await sickLeavePage.hasRow(data.periodPattern);
    if (rowVisible) {
      const state = await sickLeavePage.getState(data.periodPattern);
      expect(state.toLowerCase()).toMatch(/deleted/i);
    }
    await verification.captureStep(testInfo, "sick-leave-deleted");
  } finally {
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
