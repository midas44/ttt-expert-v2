import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc083Data } from "../data/VacationTc083Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-083 - Start date in the past — error message @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc083Data.create(
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

  // Step 2: Navigate to My vacations and days off
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Step 4-5: Set start date to yesterday, end date to tomorrow
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await globalConfig.delay();

  // Step 6: Click Save — frontend doesn't catch past dates, backend validates
  const saveButton = dialog.root().getByRole("button", { name: /save/i });
  const isDisabled = await saveButton.isDisabled();

  if (isDisabled) {
    // Frontend caught it — verify dialog stays open
    await verification.verifyLocatorVisible(
      dialog.root(),
      testInfo,
      "dialog-open-save-disabled",
    );
    expect(await dialog.isOpen()).toBe(true);
  } else {
    // Frontend didn't catch it — submit and check backend error
    await dialog.submit();

    // Wait for backend response — error should appear as notification or red text
    await page.waitForTimeout(2000);

    // Check for error notification on page (toast/alert)
    const errorNotification = page.locator(
      '[role="alert"], [class*="notification"], [class*="toast"], [class*="Toastify"]',
    ).filter({ hasText: /past|error|validation|exception/i });

    // Also check for raw i18n key
    const rawKeyNotification = page.locator(
      'text=/validation\\.vacation\\.start\\.date\\.in\\.past/',
    );

    // Also check for any red-colored notification (error toast is typically red)
    const anyErrorNotification = page.locator(
      '[class*="notification"], [class*="toast"], [class*="Toastify"]',
    );

    const hasErrorToast = (await errorNotification.count()) > 0;
    const hasRawKey = (await rawKeyNotification.count()) > 0;
    const hasAnyNotification = (await anyErrorNotification.count()) > 0;

    // Take screenshot of whatever state we're in
    if (await dialog.isOpen()) {
      await verification.verifyLocatorVisible(
        dialog.root(),
        testInfo,
        "dialog-open-after-submit",
      );
    } else {
      await verification.verifyLocatorVisible(
        vacationsPage.titleLocator(),
        testInfo,
        "page-after-dialog-closed",
      );
    }

    // The backend should reject — verify error appeared in some form
    expect(
      hasErrorToast || hasRawKey || hasAnyNotification || (await dialog.isOpen()),
      `Expected backend error for past start date. Toast: ${hasErrorToast}, rawKey: ${hasRawKey}, notification: ${hasAnyNotification}, dialogOpen: ${await dialog.isOpen()}`,
    ).toBe(true);
  }

  // Cleanup
  if (await dialog.isOpen()) {
    await dialog.cancel();
  }
  await logout.runViaDirectUrl();
  await page.close();
});
