import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { SickLeaveSetupData } from "../../data/sick-leave/SickLeaveSetupData";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiSickLeaveSetupFixture } from "@ttt/fixtures/ApiSickLeaveSetupFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { MySickLeavePage } from "@ttt/pages/MySickLeavePage";

/**
 * TC-SL-007: Edit sick leave — add document number.
 * Setup: create sick leave WITHOUT number via UI.
 * Test: edit to add number "SN-2026-002", save, verify number appears in table.
 * Number field: @Size(max=40). Optional for edit, required for close.
 */
test("TC-SL-007: Edit sick leave — add document number @regress @sick-leave @col-absences", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc007Data",
    60,
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

    // SETUP: Create sick leave WITHOUT number via UI
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

    // Verify row exists with empty Number column
    await sickLeavePage.waitForRow(data.periodPattern, 15000);
    const numberBefore = await sickLeavePage.getNumber(data.periodPattern);
    expect(numberBefore.trim()).toBe("");
    await verification.captureStep(testInfo, "sick-leave-created-no-number");

    // Capture ID for cleanup
    const { findSickLeave } = await import(
      "../../data/sick-leave/queries/sickLeaveQueries"
    );
    const { DbClient } = await import("@ttt/config/db/dbClient");
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

    // Step 3: Click edit action
    const editDialog = await sickLeavePage.clickEdit(data.periodPattern);
    await globalConfig.delay();

    // Verify edit dialog opened
    const title = await editDialog.getTitle();
    expect(title.toLowerCase()).toMatch(/edit|изменени/i);
    await verification.captureStep(testInfo, "edit-dialog-open");

    // Step 4: Fill document number
    await editDialog.fillNumber("SN-2026-002");
    await globalConfig.delay();

    // Step 5: Save
    await editDialog.submit();
    await page
      .getByRole("dialog")
      .waitFor({ state: "detached", timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Step 6: Verify Number column shows "SN-2026-002"
    const numberAfter = await sickLeavePage.getNumber(data.periodPattern);
    expect(numberAfter).toContain("SN-2026-002");
    await verification.captureStep(testInfo, "number-added-via-edit");
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
