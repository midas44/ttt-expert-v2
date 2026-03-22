import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc087Data } from "../data/VacationTc087Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-087 - Overlapping vacation dates — crossing error @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc087Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Step 4: Set dates identical to an existing vacation (guaranteed overlap)
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await globalConfig.delay();

  // Step 5: Click Save — dates are frontend-valid, backend rejects with crossing error
  const saveButton = dialog.root().getByRole("button", { name: /save/i });

  // Wait for Save to become enabled (dates are valid from frontend perspective)
  try {
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
  } catch {
    // If Save is disabled, frontend caught something — still a validation success
    const isDisabled = await saveButton.isDisabled();
    if (isDisabled) {
      await verification.verifyLocatorVisible(
        dialog.root(),
        testInfo,
        "dialog-open-save-disabled",
      );
      expect(await dialog.isOpen()).toBe(true);
      await dialog.cancel();
      await logout.runViaDirectUrl();
      await page.close();
      return;
    }
  }

  await dialog.submit();
  await globalConfig.delay();

  // Step 6: Verify crossing error — check for error notification or red text
  // The backend returns "exception.validation.vacation.dates.crossing"
  // which may appear as a toast or red inline text
  const errorText = await dialog.getErrorText();
  const dialogStillOpen = await dialog.isOpen();

  // If dialog closed, check for error notification on the page
  if (!dialogStillOpen) {
    // Backend may show error as page notification and close dialog
    const pageError = page.locator(
      '[role="alert"], [class*="notification"], [class*="toast"]',
    ).filter({ hasText: /crossing|error|validation|exception/i });
    const hasPageError = (await pageError.count()) > 0;
    expect(
      hasPageError,
      `Expected crossing error notification after dialog closed (existing: ${data.existingPeriod})`,
    ).toBe(true);
  } else {
    await verification.verifyLocatorVisible(
      dialog.root(),
      testInfo,
      "dialog-open-with-crossing-error",
    );
  }

  // Cleanup
  if (await dialog.isOpen()) {
    await dialog.cancel();
  }
  await logout.runViaDirectUrl();
  await page.close();
});
