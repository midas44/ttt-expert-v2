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
 * TC-SL-002: Create sick leave with document number.
 * Verifies that the optional "Number of the sick note" field is saved
 * and displayed in the table's Number column.
 * Number max length: 40 characters. Optional on create, required on close.
 */
test("TC-SL-002: Create sick leave with document number @regress @sick-leave @col-absences", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await SickLeaveSetupData.create(
    globalConfig.testDataMode,
    tttConfig,
    "SickLeaveTc002Data",
    50,
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

    // Step 3: Open create dialog
    const dialog = await sickLeavePage.openCreateDialog();
    await globalConfig.delay();

    // Step 4: Fill dates
    await dialog.fillDates(data.startInput, data.endInput);
    await globalConfig.delay();

    // Step 5: Fill document number
    await dialog.fillNumber("SN-2026-001");
    await globalConfig.delay();
    await verification.captureStep(testInfo, "dialog-filled-with-number");

    // Step 6: Submit
    await dialog.submit();
    await page
      .getByRole("dialog")
      .waitFor({ state: "detached", timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await globalConfig.delay();

    // Step 7: Verify row appears
    const row = await sickLeavePage.waitForRow(data.periodPattern, 15000);
    await expect(row).toBeVisible();

    // Step 8: Verify Number column shows "SN-2026-001"
    const number = await sickLeavePage.getNumber(data.periodPattern);
    expect(number).toContain("SN-2026-001");
    await verification.captureStep(testInfo, "sick-leave-created-with-number");

    // Get ID for cleanup
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
