import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc048Data } from "../data/VacationTc048Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationPaymentPage } from "../pages/VacationPaymentPage";

test("TC-VAC-048 - Pay APPROVED vacation (accountant view) @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc048Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // === Login as accountant ===
  const login = new LoginFixture(
    page,
    tttConfig,
    data.accountantLogin,
    globalConfig,
  );
  await login.run();
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  await mainFixture.ensureLanguage("EN");

  // === Navigate to Vacation Payment page ===
  await page.goto(tttConfig.buildUrl("/vacation/payment"));
  const paymentPage = new VacationPaymentPage(page);
  await paymentPage.waitForReady();
  await globalConfig.delay();

  // Click the correct payment month tab if needed
  const monthTab = page.getByRole("button", { name: data.paymentMonthTab, exact: true });
  if (await monthTab.count() > 0) {
    await monthTab.click();
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();
  }

  // === Find the vacation row by employee name ===
  const row = await paymentPage.waitForVacationRow(data.employeeName, data.periodPattern);

  // Verify status is "Not paid" before payment
  const verification = new VerificationFixture(page, globalConfig);
  const statusText = await paymentPage.columnValue("Status", data.employeeName, data.periodPattern);
  expect(statusText.trim()).toContain("Not paid");

  // Verify duration column shows correct days
  const durationText = await paymentPage.columnValue("Duration", data.employeeName, data.periodPattern);
  expect(Number(durationText.trim())).toBe(data.regularDays + data.administrativeDays);

  // === Check the row checkbox and pay ===
  await paymentPage.checkRow(data.employeeName, data.periodPattern);
  await globalConfig.delay();

  // Click "Pay all the checked requests"
  await paymentPage.clickPayAll();
  await globalConfig.delay();

  // === Verify vacation disappears from the payment list ===
  await paymentPage.waitForVacationRowToDisappear(data.employeeName, data.periodPattern);

  // Verify the payment page is still visible (confirms we're on the right page)
  await verification.verify("Vacation payment", testInfo);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
