import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc015Data } from "../data/VacationTc015Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-015 - Verify payment month auto-calculation @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc015Data.create(
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

  // Step 3: Click "Create a request"
  const dialog = await vacationsPage.openCreateRequest();

  // Step 4-5: Set dates (2 weeks from now, Mon-Fri)
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Step 6: Verify "Vacation pay to be paid with salary for" auto-populated
  const paymentMonth = await dialog.getPaymentMonthText();
  expect(paymentMonth).not.toBe("");

  // Verify the payment month matches the expected value (1st of start date's month)
  // The field may show dd.mm.yyyy or month name format
  if (paymentMonth.includes(".")) {
    // dd.mm.yyyy format — verify it matches expectedPaymentMonth
    expect(paymentMonth).toBe(data.expectedPaymentMonth);
  } else {
    // Month name format (e.g., "April 2026") — verify it contains start month name
    expect(paymentMonth.toLowerCase()).toContain(
      data.startMonthName.toLowerCase().slice(0, 3),
    );
  }

  // Step 7: Verify no red errors in dialog
  await dialog.assertNoDominantRedText();

  await verification.verifyLocatorVisible(
    dialog.root(),
    testInfo,
    "payment-month-auto-calculated",
  );

  // Step 8: Close dialog without saving
  await dialog.cancel();

  await logout.runViaDirectUrl();
  await page.close();
});
