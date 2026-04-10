import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { SickLeaveSetupData } from "../../data/sick-leave/SickLeaveSetupData";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiSickLeaveSetupFixture } from "../../fixtures/ApiSickLeaveSetupFixture";
import { MainPage } from "../../pages/MainPage";
import { MySickLeavePage } from "../../pages/MySickLeavePage";

/**
 * TC-SL-009: Close sick leave — requires document number.
 * Setup: create sick leave WITHOUT number via UI.
 * Test: attempt close with empty number -> validation blocks -> fill number -> close succeeds.
 * Expected: close blocked without number, succeeds after entering number.
 * Error code: exception.validation.sickLeave.number.empty
 */
test("TC-SL-009: Close sick leave — requires document number @regress @sick-leave @col-absences", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc009Data",
    35,
    4,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const sickLeavePage = new MySickLeavePage(page);
  let createdSickLeaveId: number | undefined;

  try {
    // Login and set language
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Navigate to My Sick Leaves
    await page.goto(`${tttConfig.appUrl}/sick-leave/my`, {
      waitUntil: "domcontentloaded",
    });
    await sickLeavePage.waitForReady();
    await globalConfig.delay();

    // SETUP: Create sick leave WITHOUT document number
    const createDialog = await sickLeavePage.openCreateDialog();
    await createDialog.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();
    await createDialog.submit();
    await page
      .getByRole("dialog")
      .waitFor({ state: "detached", timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Verify row exists
    await sickLeavePage.waitForRow(data.periodPattern, 15000);
    await verification.captureStep(testInfo, "sick-leave-created-no-number");

    // Capture ID for cleanup
    const { findSickLeave } = await import(
      "../../data/sick-leave/queries/sickLeaveQueries"
    );
    const { DbClient } = await import("../../config/db/dbClient");
    const db = new DbClient(tttConfig);
    try {
      const sl = await findSickLeave(
        db,
        data.username,
        data.startDateIso,
        data.endDateIso,
      );
      if (sl) createdSickLeaveId = sl.id;
    } finally {
      await db.close();
    }

    // Step 3: Click close action
    await sickLeavePage.clickClose(data.periodPattern);
    await globalConfig.delay();

    // Step 4: Close dialog opens
    const closeDialog = page.getByRole("dialog");
    await closeDialog.waitFor({ state: "visible", timeout: 5000 });
    await verification.captureStep(testInfo, "close-dialog-open");

    // Step 5-6: Leave number empty, click Close/Save
    const closeBtn = closeDialog
      .getByRole("button", { name: /close|end|save/i })
      .last();
    await closeBtn.click();
    await globalConfig.delay();

    // Step 7: Verify dialog stays open — validation prevents close without number
    await expect(closeDialog).toBeVisible({ timeout: 3000 });
    await verification.captureStep(testInfo, "validation-error-number-required");

    // Step 8: Fill number in the close dialog
    const numberArea = closeDialog
      .locator("div")
      .filter({ hasText: /Number of the sick note|Номер больничного/i })
      .last();
    const numberInput = numberArea.locator("input");
    if ((await numberInput.count()) > 0) {
      await numberInput.fill("SN-009");
    } else {
      // Fallback: find any text input in the dialog
      await closeDialog
        .locator("input[type='text'], input:not([type])")
        .first()
        .fill("SN-009");
    }
    await globalConfig.delay();

    // Step 9: Click Close/Save again — should succeed now
    await closeBtn.click();
    await globalConfig.delay();

    // Step 10: Verify dialog closes
    await closeDialog
      .waitFor({ state: "detached", timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Verify state changed to Ended/Closed
    const state = await sickLeavePage.getState(data.periodPattern);
    expect(state.toLowerCase()).toMatch(/ended|closed/);

    // Verify number now shows in table
    const numberAfter = await sickLeavePage.getNumber(data.periodPattern);
    expect(numberAfter).toContain("SN-009");
    await verification.captureStep(testInfo, "sick-leave-closed-with-number");
  } finally {
    if (createdSickLeaveId) {
      const setup = new ApiSickLeaveSetupFixture(page, tttConfig);
      await setup
        .deleteSickLeave(createdSickLeaveId)
        .catch((e) => console.warn(`Cleanup failed: ${e.message}`));
    }
    await logout.runViaDirectUrl().catch(() => {});
    await page.close();
  }
});
