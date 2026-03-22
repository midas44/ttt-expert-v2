import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc086Data } from "../data/VacationTc086Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-086 - Vacation with 0 working days (Sat-Sun only) — duration error @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc086Data.create(
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

  // Step 4-5: Set dates to Saturday-Sunday (0 working days)
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await globalConfig.delay();

  // Step 5: Verify "Number of days" shows 0
  const numberOfDays = await dialog.getNumberOfDays();
  expect(
    numberOfDays,
    `Expected 0 working days for Sat-Sun range, got "${numberOfDays}"`,
  ).toBe("0");

  // Step 6: Click Save — should be disabled or backend rejects
  const saveButton = dialog.root().getByRole("button", { name: /save/i });
  const isDisabled = await saveButton.isDisabled();

  if (isDisabled) {
    // Frontend prevents submission — Save disabled when 0 days
    await verification.verifyLocatorVisible(
      dialog.root(),
      testInfo,
      "dialog-save-disabled-zero-days",
    );
    expect(await dialog.isOpen()).toBe(true);
  } else {
    // Frontend allows click — submit and check for backend error
    await dialog.submit();
    await page.waitForTimeout(2000);

    // Step 7: Verify error about minimum vacation duration
    const errorText = await dialog.getErrorText();
    const dialogStillOpen = await dialog.isOpen();

    if (!dialogStillOpen) {
      const pageError = page.locator(
        '[role="alert"], [class*="notification"], [class*="toast"], [class*="Toastify"]',
      ).filter({ hasText: /duration|error|validation|exception|minimum/i });
      const rawKeyError = page.locator(
        'text=/validation\\.vacation\\.duration/',
      );
      const hasPageError = (await pageError.count()) > 0;
      const hasRawKey = (await rawKeyError.count()) > 0;

      await verification.verifyLocatorVisible(
        vacationsPage.titleLocator(),
        testInfo,
        "page-after-zero-days-error",
      );

      expect(
        hasPageError || hasRawKey,
        `Expected duration validation error. Toast: ${hasPageError}, rawKey: ${hasRawKey}`,
      ).toBe(true);
    } else {
      expect(
        errorText.length,
        `Expected error text for zero-day vacation, got empty`,
      ).toBeGreaterThan(0);

      await verification.verifyLocatorVisible(
        dialog.root(),
        testInfo,
        "dialog-zero-days-error",
      );
    }
  }

  // Cleanup
  if (await dialog.isOpen()) {
    await dialog.cancel();
  }
  await logout.runViaDirectUrl();
  await page.close();
});
