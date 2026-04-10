import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc071Data } from "../../data/vacation/VacationTc071Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-071: Regression — Overlapping vacations not blocked by frontend (#3240).
 * SETUP: Creates a vacation for pvaynmaster.
 * Test: Attempts to create a second vacation with overlapping dates.
 * Verifies frontend shows overlap/crossing error and Save button is disabled or shows error on submit.
 * Bug #3240 (fixed): previously frontend did not block overlapping vacations.
 */
test("TC-VAC-071: Overlapping vacations blocked by frontend @regress @vacation @regression", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc071Data.create(globalConfig.testDataMode, tttConfig);
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create first vacation via API
  const vacation = await setup.createVacation(data.existingStartIso, data.existingEndIso);

  try {
    // Step 1-2: Login, switch to English, navigate
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }
    await page.goto(`${tttConfig.appUrl}/vacation/my`, { waitUntil: "domcontentloaded" });
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Open creation dialog
    const dialog = await vacationsPage.openCreateRequest();

    // Step 4: Select overlapping dates
    await dialog.fillVacationPeriod(data.overlapStartInput, data.overlapEndInput);
    await globalConfig.delay();

    // Step 5-6: Verify overlap error appears
    // The frontend should show a crossing/overlap validation message
    const validationMsg = await dialog.getValidationMessage();
    const errorText = await dialog.getErrorText();
    const combinedText = `${validationMsg} ${errorText}`.toLowerCase();

    // Check for overlap/crossing error keywords
    const hasOverlapError =
      /cross|overlap|already have|already exists|conflict|vacation request for/i.test(combinedText);

    if (hasOverlapError) {
      // Overlap error detected before submission
      await verification.captureStep(testInfo, "overlap-error-before-save");
    } else {
      // Attempt to submit — should fail with error
      await dialog.submit();
      await globalConfig.delay();

      // Check for error after submission
      const postSubmitError = await dialog.getErrorText();
      const notifText = await vacationsPage.findNotification("crossing").catch(() => null);
      const hasPostSubmitError =
        /cross|overlap|already|conflict/i.test(postSubmitError) || notifText !== null;
      expect(hasPostSubmitError).toBe(true);
      await verification.captureStep(testInfo, "overlap-error-after-submit");
    }

    // Close dialog if still open
    if (await dialog.isOpen()) {
      await dialog.cancel();
    }
  } finally {
    // CLEANUP
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
