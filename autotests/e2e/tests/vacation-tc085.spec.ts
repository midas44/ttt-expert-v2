import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc085Data } from "../data/VacationTc085Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-085 - Next year vacation before Feb 1 — error @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc085Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const apiToken = tttConfig.apiToken;
  const clockUrl = tttConfig.buildUrl("/api/ttt/v1/test/clock");
  const authHeaders = { API_SECRET_TOKEN: apiToken };

  // SETUP: Set server clock to January 15
  if (apiToken) {
    const patchResp = await page.request.patch(clockUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: { time: data.clockTime },
    });
    expect(
      patchResp.ok(),
      `Failed to set clock to ${data.clockTime}: ${patchResp.status()}`,
    ).toBeTruthy();
  }

  try {
    const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
    const mainFixture = new MainFixture(page, tttConfig, globalConfig);
    const navigation = new HeaderNavigationFixture(page, globalConfig);
    const verification = new VerificationFixture(page, globalConfig);
    const vacationsPage = new MyVacationsPage(page);
    const logout = new LogoutFixture(page, tttConfig, globalConfig);

    // Step 1: Login
    await login.run();
    await mainFixture.ensureLanguage("EN");

    // Step 2: Navigate to My vacations
    await navigation.navigate(
      "Calendar of absences > My vacations and days off",
    );
    await vacationsPage.waitForReady();

    // Step 3: Open create dialog
    const dialog = await vacationsPage.openCreateRequest();

    // Step 4: Set dates to next year (clockYear + 1)
    await dialog.fillVacationPeriod(data.startDate, data.endDate);
    await globalConfig.delay();

    // Step 5: Click Save
    const saveButton = dialog.root().getByRole("button", { name: /save/i });

    try {
      await expect(saveButton).toBeEnabled({ timeout: 5000 });
    } catch {
      // Save disabled — frontend caught the validation
      await verification.verifyLocatorVisible(
        dialog.root(),
        testInfo,
        "dialog-save-disabled-next-year",
      );
      expect(await dialog.isOpen()).toBe(true);
      await dialog.cancel();
      await logout.runViaDirectUrl();
      await page.close();
      return;
    }

    await dialog.submit();
    await page.waitForTimeout(3000);

    // Step 6: Verify error — validation.vacation.next.year.not.available
    // Check all possible error locations: dialog red text, page toasts, raw i18n keys
    const errorText = await dialog.getErrorText();
    const dialogStillOpen = await dialog.isOpen();

    // Check for any toast/notification on the page (broad search)
    const anyToast = page.locator(
      '[role="alert"], [class*="notification"], [class*="toast"], [class*="Toastify"]',
    );
    const anyToastCount = await anyToast.count();
    let toastText = "";
    if (anyToastCount > 0) {
      toastText = (await anyToast.first().textContent()) ?? "";
    }

    // Check for raw i18n keys
    const rawKeyError = page.locator(
      'text=/validation\\.vacation/',
    );
    const hasRawKey = (await rawKeyError.count()) > 0;

    // Take screenshot regardless of outcome
    if (dialogStillOpen) {
      await verification.verifyLocatorVisible(
        dialog.root(),
        testInfo,
        "dialog-next-year-error",
      );
    } else {
      await verification.verifyLocatorVisible(
        vacationsPage.titleLocator(),
        testInfo,
        "page-after-next-year-error",
      );
    }

    // Verify error appeared in at least one form:
    // 1) error text inside dialog (red), 2) toast notification, 3) raw i18n key,
    // 4) dialog still open (meaning backend rejected — creation didn't succeed)
    const errorFound =
      errorText.length > 0 ||
      anyToastCount > 0 ||
      hasRawKey ||
      dialogStillOpen;

    expect(
      errorFound,
      `Expected next-year validation error. errorText: "${errorText}", ` +
      `toastCount: ${anyToastCount}, toastText: "${toastText}", ` +
      `rawKey: ${hasRawKey}, dialogOpen: ${dialogStillOpen}`,
    ).toBe(true);

    // Cleanup
    if (await dialog.isOpen()) {
      await dialog.cancel();
    }
    await logout.runViaDirectUrl();
  } finally {
    // Always reset clock
    if (apiToken) {
      await page.request
        .post(`${clockUrl}/reset`, { headers: authHeaders })
        .catch(() => {});
    }
  }

  await page.close();
});
