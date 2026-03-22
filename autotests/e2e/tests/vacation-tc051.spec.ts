import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc051Data } from "../data/VacationTc051Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationPaymentPage } from "../pages/VacationPaymentPage";

test("TC-VAC-051 - Verify payment page table and columns @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc051Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // === Login as accountant ===
  const login = new LoginFixture(page, tttConfig, data.accountantLogin, globalConfig);
  await login.run();
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  await mainFixture.ensureLanguage("EN");

  // === Navigate to Vacation Payment page ===
  await page.goto(tttConfig.buildUrl("/vacation/payment"));
  const paymentPage = new VacationPaymentPage(page);
  await paymentPage.waitForReady();
  await globalConfig.delay();

  // === Verify page title ===
  await expect(page.locator("text=Vacation payment").first()).toBeVisible();

  // === Verify table columns are present ===
  const expectedColumns = [
    "Employee",
    "Vacation dates",
    "Duration",
    "Vacation type",
    "Salary office",
    "Status",
    "Actions",
  ];

  const headerCells = page.locator("table thead th");
  const headerTexts = await headerCells.allTextContents();
  const normalizedHeaders = headerTexts.map((h) => h.trim().toLowerCase());

  for (const col of expectedColumns) {
    expect(
      normalizedHeaders.some((h) => h.includes(col.toLowerCase())),
      `Column "${col}" should be present in payment table`,
    ).toBe(true);
  }

  // === Verify table has data rows ===
  const rowCount = await paymentPage.getRowCount();
  expect(rowCount, "Payment page should have at least one vacation row").toBeGreaterThan(0);

  // === Verify first row has data in key columns ===
  const firstRow = page.locator("table tbody tr").first();
  const firstRowText = await firstRow.textContent() ?? "";
  // Row should contain employee name and dates — not be empty
  expect(firstRowText.length).toBeGreaterThan(5);

  // === Verify pagination exists if many records ===
  const pagination = page.locator('nav[aria-label="Pagination"]');
  const hasPagination = await pagination.count() > 0;
  if (hasPagination) {
    const pageButtons = pagination.locator("button").filter({ hasNotText: /Previous|Next/i });
    const pageCount = await pageButtons.count();
    expect(pageCount, "Pagination should have at least 1 page button").toBeGreaterThanOrEqual(1);

    // If multiple pages, click page 2 and verify table reloads
    if (pageCount > 1) {
      await pageButtons.nth(1).click();
      await page.waitForLoadState("networkidle");
      await globalConfig.delay();
      const page2Rows = await paymentPage.getRowCount();
      expect(page2Rows, "Page 2 should have rows").toBeGreaterThan(0);
    }
  }

  const verification = new VerificationFixture(page, globalConfig);
  await verification.verify("Vacation payment", testInfo);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
