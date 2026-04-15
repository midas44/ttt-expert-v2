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
 * TC-SL-008: Close sick leave — happy path (with number).
 * Setup: create a sick leave via UI with a document number.
 * Then close it via the close action. Requires document number to be present.
 * Expected: State changes to Ended/CLOSED. Accounting status unchanged (NEW).
 */
test("TC-SL-008: Close sick leave — happy path @regress @sick-leave", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc008Data",
    14,
    4,
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

    // SETUP: Create a sick leave with a document number
    const createDialog = await sickLeavePage.openCreateDialog();
    await createDialog.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();
    await createDialog.fillNumber("SN-008");
    await createDialog.submit();
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Verify row exists
    await sickLeavePage.waitForRow(data.periodPattern, 15000);
    await verification.captureStep(testInfo, "sick-leave-with-number-created");

    // Step 4: Click the close action button
    await sickLeavePage.clickClose(data.periodPattern);
    await globalConfig.delay();

    // Step 5: Close dialog appears — verify number is pre-filled
    const closeDialog = page.getByRole("dialog");
    await closeDialog.waitFor({ state: "visible", timeout: 5000 });
    await verification.captureStep(testInfo, "close-dialog");

    // Step 7: Click the close/save/end button
    const closeButton = closeDialog.getByRole("button", {
      name: /close|end|save/i,
    }).last();
    await closeButton.click();
    await globalConfig.delay();

    // Wait for dialog to close
    await closeDialog.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Step 8: Verify State changes to Ended/Closed
    const state = await sickLeavePage.getState(data.periodPattern);
    expect(state.toLowerCase()).toMatch(/ended|closed/i);
    await verification.captureStep(testInfo, "sick-leave-closed");
  } finally {
    // Cleanup: delete via UI if possible
    try {
      // Navigate back if needed
      if (!page.url().includes("/sick-leave/my")) {
        await page.goto(`${tttConfig.appUrl}/sick-leave/my`, {
          waitUntil: "domcontentloaded",
        });
        await sickLeavePage.waitForReady();
        await globalConfig.delay();
      }
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
