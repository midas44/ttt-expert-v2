import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc050Data } from "../data/VacationTc050Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";

test("TC-VAC-050 - Cannot pay non-APPROVED vacation @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc050Data.create(
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
  await page.waitForLoadState("networkidle");
  await page.locator("text=Vacation payment").first().waitFor({ state: "visible" });
  await globalConfig.delay();

  // === Verify that only APPROVED vacations appear in the payment queue ===
  // The payment page should NOT show NEW, REJECTED, or CANCELED vacations
  const tableRows = page.locator("table tbody tr").filter({ has: page.locator("td") });
  const rowCount = await tableRows.count();

  if (rowCount > 0) {
    // Check all visible rows — none should show "New", "Rejected", or "Canceled" status
    for (let i = 0; i < Math.min(rowCount, 20); i++) {
      const rowText = (await tableRows.nth(i).textContent()) ?? "";
      const hasNewStatus = /\bNew\b/.test(rowText);
      const hasRejectedStatus = /\bRejected\b/i.test(rowText);
      const hasCanceledStatus = /\bCancel/i.test(rowText);
      expect(
        hasNewStatus,
        `Row ${i} should not show NEW status in payment queue`,
      ).toBe(false);
      expect(
        hasRejectedStatus,
        `Row ${i} should not show REJECTED status in payment queue`,
      ).toBe(false);
      expect(
        hasCanceledStatus,
        `Row ${i} should not show CANCELED status in payment queue`,
      ).toBe(false);
    }
  }

  // === Also check across pagination pages (if pagination exists) ===
  const pagination = page.locator('nav[aria-label="Pagination"]');
  if (await pagination.count() > 0) {
    const pageButtons = pagination.locator("button").filter({ hasNotText: /Previous|Next/i });
    const pageCount = await pageButtons.count();
    for (let p = 1; p < Math.min(pageCount, 3); p++) {
      const btn = pageButtons.nth(p);
      const text = (await btn.textContent()) ?? "";
      if (!/^\d+$/.test(text.trim())) continue;
      await btn.click();
      await page.waitForLoadState("networkidle");
      await globalConfig.delay();

      const pageRows = page.locator("table tbody tr").filter({ has: page.locator("td") });
      const pgRowCount = await pageRows.count();
      for (let i = 0; i < Math.min(pgRowCount, 20); i++) {
        const rowText = (await pageRows.nth(i).textContent()) ?? "";
        expect(/\bNew\b/.test(rowText), `Page ${p + 1} row ${i}: no NEW status`).toBe(false);
        expect(/\bRejected\b/i.test(rowText), `Page ${p + 1} row ${i}: no REJECTED status`).toBe(false);
      }
    }
  }

  const verification = new VerificationFixture(page, globalConfig);
  await verification.verify("Vacation payment", testInfo);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
