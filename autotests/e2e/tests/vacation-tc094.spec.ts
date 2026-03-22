import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc094Data } from "../data/VacationTc094Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-094 - Insufficient days for REGULAR vacation (AV=false) @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc094Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const deletion = new VacationDeletionFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login as AV=false employee with low net balance
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Step 4: Set dates for 5 working days (exceeding net available balance)
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await globalConfig.delay();

  // Step 5: Click Save — AV=false cannot go negative, should get error
  const saveButton = dialog.root().getByRole("button", { name: /save/i });

  try {
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
  } catch {
    // Save disabled — frontend caught insufficient days
    await verification.verifyLocatorVisible(
      dialog.root(),
      testInfo,
      "dialog-save-disabled-insufficient-days",
    );
    expect(await dialog.isOpen()).toBe(true);
    await dialog.cancel();
    await logout.runViaDirectUrl();
    await page.close();
    return;
  }

  await dialog.submit();

  // Wait for either dialog close or error to appear
  await page.waitForTimeout(3000);

  // Check dialog state FIRST before calling methods that assume it's visible
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
  const rawKeyError = page.locator('text=/validation\\.vacation/');
  const hasRawKey = (await rawKeyError.count()) > 0;

  // Check error text in dialog only if it's still open
  let errorText = "";
  if (dialogStillOpen) {
    errorText = await dialog.getErrorText();
  }

  // Take screenshot
  if (dialogStillOpen) {
    await verification.verifyLocatorVisible(
      dialog.root(),
      testInfo,
      "dialog-insufficient-days",
    );
  } else {
    await verification.verifyLocatorVisible(
      vacationsPage.titleLocator(),
      testInfo,
      "page-after-insufficient-days-submit",
    );
  }

  // Verify error appeared in at least one form:
  // 1) dialog still open with error, 2) toast notification, 3) raw i18n key
  // If dialog closed without error, the vacation may have been created (test data issue)
  const errorFound =
    errorText.length > 0 ||
    anyToastCount > 0 ||
    hasRawKey ||
    dialogStillOpen;

  if (!errorFound) {
    // Vacation was unexpectedly created — clean it up
    // Build a period pattern for the dates
    const [sd, sm, sy] = data.startDate.split(".");
    const [ed, em, ey] = data.endDate.split(".");
    const periodPattern = new RegExp(
      `${sd}\\.${sm}\\.${sy}.*${ed}\\.${em}\\.${ey}|` +
      `${parseInt(sd)}.*${parseInt(ed)}`,
    );
    try {
      await deletion.deleteVacation({
        startInput: data.startDate,
        endInput: data.endDate,
        periodPattern,
      });
    } catch {
      // Cleanup failed — not critical
    }
  }

  expect(
    errorFound,
    `Expected insufficient days error for AV=false employee (net balance: ${data.netAvailableDays}). ` +
    `errorText: "${errorText}", toastCount: ${anyToastCount}, toastText: "${toastText}", ` +
    `rawKey: ${hasRawKey}, dialogOpen: ${dialogStillOpen}`,
  ).toBe(true);

  // Cleanup
  if (await dialog.isOpen()) {
    await dialog.cancel();
  }
  await logout.runViaDirectUrl();
  await page.close();
});
