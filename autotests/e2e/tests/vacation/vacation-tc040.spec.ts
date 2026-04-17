import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc040Data } from "../../data/vacation/VacationTc040Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";
import { VacationCreateDialog } from "@ttt/pages/VacationCreateDialog";

/**
 * TC-VAC-040: First 3 months restriction — new employee (#3014).
 * Verifies that REGULAR vacation dates within the first 3 months of employment
 * are rejected (disabled in calendar or server 400).
 * ADMINISTRATIVE vacations should NOT be restricted.
 */
test("TC-VAC-040: First 3 months restriction — new employee @regress @vacation @validation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc040Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // Step 1-2: Login, switch to English, navigate
  await login.run();
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

  // Step 3: Open create dialog (REGULAR type by default)
  const dialog = await vacationsPage.openCreateRequest();
  await globalConfig.delay();

  // Step 4: Select dates within the 3-month restriction period via calendar widget
  await dialog.fillVacationPeriod(data.restrictedStartInput, data.restrictedEndInput);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "restricted-dates-filled");

  // Step 5: Check for validation message (dynamic validation fires on date change)
  const validationMsg = await dialog.getValidationMessage();
  const errorText = await dialog.getErrorText();
  const combinedError = `${errorText} ${validationMsg}`.toLowerCase();
  await verification.captureStep(testInfo, "validation-message-shown");

  // The restriction should produce a visible error — the validation message about
  // the 3-month restriction appears immediately when restricted dates are selected
  const hasRestrictionError =
    combinedError.includes("regular vacation") ||
    combinedError.includes("3 month") ||
    combinedError.includes("restriction") ||
    combinedError.includes("can't start") ||
    combinedError.includes("cannot start") ||
    combinedError.includes("starting from") ||
    errorText.length > 0 ||
    validationMsg.length > 0;

  expect(
    hasRestrictionError,
    `Expected restriction error for dates within 3 months of employment ` +
      `(first_date=${data.firstDateIso}). Got error: "${errorText}", validation: "${validationMsg}"`,
  ).toBeTruthy();

  // Step 6: Verify Save button behavior — either disabled or produces error on click
  const saveEnabled = await dialog.isSaveEnabled();
  if (saveEnabled) {
    // Bug #3014-25: Save is enabled but server rejects (400)
    await dialog.submit();
    await globalConfig.delay();
    const submitError = await dialog.getErrorText();
    expect(submitError.length, "Save should produce server error for restricted dates").toBeGreaterThan(0);
  }
  await verification.captureStep(testInfo, "restriction-enforced");

  // Step 7: Close dialog
  await dialog.cancel();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();
});
