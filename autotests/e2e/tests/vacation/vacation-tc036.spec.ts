import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc036Data } from "../../data/vacation/VacationTc036Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";
import { VacationCreateDialog } from "@ttt/pages/VacationCreateDialog";

/**
 * TC-VAC-036: Insufficient available days — REGULAR blocked.
 * Employee with limited days requests a vacation exceeding their balance.
 * Expected: red error (validation.vacation.duration), submit blocked.
 */
test("TC-VAC-036: Insufficient available days — REGULAR blocked @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc036Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1-2: Login, switch to English
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 3: Navigate to My Vacations
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  const vacationsPage = new MyVacationsPage(page);
  await vacationsPage.waitForReady();

  // Step 4: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Step 5: Select dates spanning more working days than available
  await dialog.fillVacationPeriod(data.startInput, data.endInput);
  await globalConfig.delay();

  // Wait for dynamic validation to fire (frontend validates on field change)
  await page.waitForTimeout(2000);

  // Step 6: Verify red error message appears indicating insufficient days
  const errorText = await dialog.getErrorText();
  expect(
    errorText,
    `Expected error about insufficient days (available: ${data.availableDays}, requested: ~${data.requestedDays})`,
  ).toBeTruthy();

  // Match actual error format: "N of the requested M | reduce vacation length..."
  // Also accept raw i18n key formats as fallback
  expect(errorText.toLowerCase()).toMatch(
    /requested|reduce|insufficient|duration|vacation\.duration|unpaid/i,
  );
  await verification.captureStep(testInfo, "insufficient-days-error-shown");

  // Step 7: Verify Save button is disabled (frontend blocks submission on validation error)
  const saveButton = dialog.root().getByRole("button", { name: /save/i });
  const isDisabled = await saveButton.isDisabled().catch(() => false);
  // The button may be disabled, or clicking it may simply do nothing
  if (!isDisabled) {
    // Try submit — if error is visible, the backend should also reject
    await dialog.submit().catch(() => {});
    await globalConfig.delay();
  }

  // Dialog should still be open (submit blocked or rejected)
  const stillOpen = await dialog.isOpen();
  expect(
    stillOpen,
    "Dialog should remain open when insufficient days",
  ).toBe(true);
  await verification.captureStep(testInfo, "insufficient-days-submit-blocked");

  // Close dialog
  await dialog.cancel();

  await logout.runViaDirectUrl();
  await page.close();
  // No cleanup needed — creation should have failed
});
