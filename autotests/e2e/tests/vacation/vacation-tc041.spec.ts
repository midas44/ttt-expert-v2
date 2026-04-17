import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc041Data } from "../../data/vacation/VacationTc041Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";
import { VacationCreateDialog } from "@ttt/pages/VacationCreateDialog";
import { DbClient } from "@ttt/config/db/dbClient";
import { findVacationId } from "../../data/vacation/queries/vacationQueries";

/**
 * TC-VAC-041: First 3 months — ADMINISTRATIVE not restricted (#3014).
 * Verifies that ADMINISTRATIVE (unpaid) vacations bypass the 3-month restriction
 * for recently-hired employees. The employee can create an unpaid vacation
 * within the first 3 months of employment.
 */
test("TC-VAC-041: First 3 months — ADMINISTRATIVE not restricted @regress @vacation @validation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc041Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const loginFixture = new LoginFixture(
    page,
    tttConfig,
    data.username,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  let createdVacationId: number | null = null;

  try {
    // Step 1-2: Login, switch to English, navigate
    await loginFixture.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Open create dialog
    const dialog = await vacationsPage.openCreateRequest();
    await globalConfig.delay();

    // Step 4: Check "Unpaid vacation" checkbox (switches to ADMINISTRATIVE type)
    await dialog.ensureUnpaidVacationChecked();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "unpaid-checkbox-checked");

    // Step 5-6: Select dates within the 3-month restriction period
    await dialog.fillVacationPeriod(
      data.restrictedStartInput,
      data.restrictedEndInput,
    );
    await globalConfig.delay();
    await verification.captureStep(testInfo, "restricted-dates-filled-admin");

    // Step 7: Verify NO restriction error (ADMINISTRATIVE bypasses 3-month rule)
    const validationMsg = await dialog.getValidationMessage();
    const errorText = await dialog.getErrorText();
    const combinedError = `${errorText} ${validationMsg}`.toLowerCase();

    const hasRestrictionError =
      combinedError.includes("3 month") ||
      combinedError.includes("restriction") ||
      combinedError.includes("too early") ||
      combinedError.includes("can't start") ||
      combinedError.includes("cannot start");

    expect(
      hasRestrictionError,
      `ADMINISTRATIVE should NOT show 3-month restriction error. Got: "${combinedError.trim()}"`,
    ).toBeFalsy();

    // Step 8: Check Save button is enabled (not blocked by validation)
    const saveEnabled = await dialog.isSaveEnabled();
    expect(
      saveEnabled,
      "Save button should be enabled for ADMINISTRATIVE within 3-month restriction",
    ).toBeTruthy();

    // Step 9: Save — should succeed for ADMINISTRATIVE
    if (saveEnabled) {
      await dialog.submit();
      await globalConfig.delay();
      await verification.captureStep(testInfo, "admin-vacation-saved");

      // Verify dialog closed (save succeeded)
      const dialogStillOpen = await dialog.isOpen();

      if (dialogStillOpen) {
        const postSaveError = await dialog.getErrorText();
        expect.soft(
          postSaveError,
          "ADMINISTRATIVE vacation save should not produce error",
        ).toBe("");
        await dialog.cancel();
      }

      if (!dialogStillOpen) {
        // Find the created vacation ID for cleanup
        const db = new DbClient(tttConfig);
        try {
          createdVacationId = await findVacationId(
            db,
            data.username,
            data.restrictedStartIso,
            data.restrictedEndIso,
          );
        } catch {
          // Vacation might not be found if save failed silently
        } finally {
          await db.close();
        }
      }
    } else {
      await dialog.cancel();
    }

    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    // CLEANUP: Delete the created vacation
    if (createdVacationId) {
      const setup = new ApiVacationSetupFixture(request, tttConfig);
      await setup.deleteVacation(createdVacationId).catch(() => {});
    }
  }
});
