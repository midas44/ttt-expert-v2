import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc044Data } from "../../data/vacation/VacationTc044Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";
import { VacationCreateDialog } from "@ttt/pages/VacationCreateDialog";

/**
 * TC-VAC-044: Dynamic validation — messages update on field change.
 * Verifies that validation messages appear/disappear dynamically as the user
 * changes vacation dates and type, without needing to click Save.
 *
 * Uses an employee with limited days (1-4) to trigger "insufficient days" error
 * when selecting a 5-day period, then verifies the error disappears when
 * shortening dates or switching to ADMINISTRATIVE (unpaid).
 */
test("TC-VAC-044: Dynamic validation — messages update on field change @regress @vacation @validation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc044Data.create(
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

  const dialog = await vacationsPage.openCreateRequest();
  await globalConfig.delay();

  // Step 1: Select LONG dates exceeding available days → expect red error
  await dialog.fillVacationPeriod(data.longStartInput, data.longEndInput);
  await globalConfig.delay();
  // Allow extra time for dynamic validation to fire
  await page.waitForTimeout(1500);
  await verification.captureStep(testInfo, "long-dates-error-expected");

  const errorAfterLong = await dialog.getErrorText();
  const validationAfterLong = await dialog.getValidationMessage();
  const hasErrorLong =
    errorAfterLong.length > 0 || validationAfterLong.length > 0;

  expect(
    hasErrorLong,
    `Expected validation error for 5-day vacation with only ${data.availableDays} available days. ` +
      `Error: "${errorAfterLong}", Validation: "${validationAfterLong}"`,
  ).toBeTruthy();

  // Step 2: Change to SHORT dates within available balance → error should disappear
  await dialog.fillVacationPeriod(data.shortStartInput, data.shortEndInput);
  await globalConfig.delay();
  await page.waitForTimeout(1500);
  await verification.captureStep(testInfo, "short-dates-no-error");

  const errorAfterShort = await dialog.getErrorText();
  const validationAfterShort = await dialog.getValidationMessage();
  const combinedShort =
    `${errorAfterShort} ${validationAfterShort}`.toLowerCase();

  // The insufficient-days error should be gone; other warnings may remain
  const hasInsufficientError =
    combinedShort.includes("insufficient") ||
    combinedShort.includes("not enough") ||
    combinedShort.includes("exceed") ||
    combinedShort.includes("available vacation days");

  expect(
    hasInsufficientError,
    `Insufficient-days error should disappear when dates are within balance. ` +
      `Error: "${errorAfterShort}", Validation: "${validationAfterShort}"`,
  ).toBeFalsy();

  // Step 3: Change BACK to long dates → error should reappear
  await dialog.fillVacationPeriod(data.longStartInput, data.longEndInput);
  await globalConfig.delay();
  await page.waitForTimeout(1500);
  await verification.captureStep(testInfo, "long-dates-error-reappears");

  const errorAfterLong2 = await dialog.getErrorText();
  const validationAfterLong2 = await dialog.getValidationMessage();
  const hasErrorLong2 =
    errorAfterLong2.length > 0 || validationAfterLong2.length > 0;

  expect(
    hasErrorLong2,
    `Validation error should reappear when long dates re-selected. ` +
      `Error: "${errorAfterLong2}", Validation: "${validationAfterLong2}"`,
  ).toBeTruthy();

  // Step 4: Check "Unpaid vacation" → error should disappear (ADMINISTRATIVE skips balance)
  await dialog.ensureUnpaidVacationChecked();
  await globalConfig.delay();
  await page.waitForTimeout(1500);
  await verification.captureStep(testInfo, "unpaid-checked-no-error");

  const errorAfterUnpaid = await dialog.getErrorText();
  const validationAfterUnpaid = await dialog.getValidationMessage();
  const combinedUnpaid =
    `${errorAfterUnpaid} ${validationAfterUnpaid}`.toLowerCase();

  const hasBalanceErrorUnpaid =
    combinedUnpaid.includes("insufficient") ||
    combinedUnpaid.includes("not enough") ||
    combinedUnpaid.includes("exceed") ||
    combinedUnpaid.includes("available vacation days");

  expect(
    hasBalanceErrorUnpaid,
    `Balance error should disappear when switched to ADMINISTRATIVE (unpaid). ` +
      `Error: "${errorAfterUnpaid}", Validation: "${validationAfterUnpaid}"`,
  ).toBeFalsy();

  // Close dialog without saving
  await dialog.cancel();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();
});
