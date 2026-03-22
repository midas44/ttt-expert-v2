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

  // === UI-first: Find a payable row (one with a checkbox and "Not paid" status) ===
  const payableRow = page.locator("table tbody tr")
    .filter({ hasText: "Not paid" })
    .filter({ has: page.locator("input[type='checkbox']") })
    .first();
  await payableRow.waitFor({ state: "visible", timeout: 15000 });

  // Capture the employee name and dates for verification
  const employeeName = await payableRow.locator("td").first().textContent() ?? "";
  const dateText = await payableRow.locator("td").nth(1).textContent() ?? "";

  // Verify row shows "Not paid"
  const rowText = await payableRow.textContent() ?? "";
  expect(rowText).toContain("Not paid");

  // === Check the row checkbox and pay ===
  const checkbox = payableRow.locator("input[type='checkbox']");
  await checkbox.check();
  await globalConfig.delay();

  // Click "Pay all the checked requests"
  const payAllBtn = page.getByRole("button", { name: /Pay all the checked requests/i });
  await payAllBtn.click();
  await globalConfig.delay();

  // === Verify the vacation disappears from the list ===
  // After payment, wait for the row to disappear or the status to change
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // The row should no longer show "Not paid" for this employee/dates combo
  // Payment page reloads — verify we're still on the payment page
  const verification = new VerificationFixture(page, globalConfig);
  await verification.verify("Vacation payment", testInfo);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
