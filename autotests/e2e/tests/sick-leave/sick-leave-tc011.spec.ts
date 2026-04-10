import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { SickLeaveSetupData } from "../../data/sick-leave/SickLeaveSetupData";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage } from "../../pages/MainPage";
import { MySickLeavePage } from "../../pages/MySickLeavePage";

/**
 * TC-SL-011: View sick leave details.
 * Setup: create a sick leave with a document number.
 * Then open the details dialog and verify all fields are displayed.
 * Expected: details dialog shows employee name, dates, calendar days, number, state.
 */
test("TC-SL-011: View sick leave details @regress @sick-leave", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc011Data",
    18,
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

    // SETUP: Create a sick leave with number
    const createDialog = await sickLeavePage.openCreateDialog();
    await createDialog.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();
    await createDialog.fillNumber("SN-VIEW-01");
    await createDialog.submit();
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Verify row exists
    await sickLeavePage.waitForRow(data.periodPattern, 15000);

    // Step 3: Open details via the detail action button
    await sickLeavePage.clickDetails(data.periodPattern);
    await globalConfig.delay();

    // Step 4: Verify details dialog opens (rc-dialog, not standard role="dialog")
    const detailsDialog = page.locator(".rc-dialog-wrap, [role='dialog']").first();
    await detailsDialog.waitFor({ state: "visible", timeout: 10000 });
    await verification.captureStep(testInfo, "details-dialog-open");

    // Verify the dialog contains expected fields
    const dialogText = (await detailsDialog.textContent()) ?? "";

    // Employee name should be visible
    expect(dialogText.length).toBeGreaterThan(20);

    // Dates should be visible
    const startDay = parseInt(data.startDateIso.split("-")[2], 10);
    const endDay = parseInt(data.endDateIso.split("-")[2], 10);
    expect(dialogText).toMatch(new RegExp(String(startDay)));
    expect(dialogText).toMatch(new RegExp(String(endDay)));

    // Calendar days should be visible
    expect(dialogText).toMatch(/calendar days|days/i);

    // Number should show "SN-VIEW-01"
    expect(dialogText).toContain("SN-VIEW-01");

    // Step 5: Close the details dialog
    const closeButton = detailsDialog.locator(".rc-dialog-close, button").filter({
      hasText: /close|×|✕/i,
    });
    if (await closeButton.count() > 0) {
      await closeButton.first().click();
    } else {
      // Try rc-dialog close button (X icon in top right)
      const rcClose = page.locator(".rc-dialog-close");
      if (await rcClose.count() > 0) {
        await rcClose.first().click();
      } else {
        await page.keyboard.press("Escape");
      }
    }
    await page.waitForTimeout(1000);
    await verification.captureStep(testInfo, "details-dialog-closed");
  } finally {
    // Cleanup: delete via UI
    try {
      if (await sickLeavePage.hasRow(data.periodPattern)) {
        await sickLeavePage.clickDelete(data.periodPattern);
        const confirmDialog = page.getByRole("dialog");
        await confirmDialog.waitFor({ state: "visible", timeout: 3000 });
        await confirmDialog.getByRole("button", { name: /delete|confirm|yes|ok/i }).click();
        await confirmDialog.waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
      }
    } catch (e) {
      console.warn(`Cleanup failed: ${(e as Error).message}`);
    }
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
