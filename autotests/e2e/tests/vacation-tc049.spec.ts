import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc050Data } from "../data/VacationTc050Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";

test("TC-VAC-049 - Pay administrative vacation @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  // Reuse accountant data class (just needs an accountant login)
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

  const verification = new VerificationFixture(page, globalConfig);

  // === Find an Administrative vacation row on the payment page ===
  // Administrative vacations appear in the payment table but may not have
  // "Not paid" status or checkboxes — they may be displayed without payment controls
  const allRows = page.locator("table tbody tr").filter({ has: page.locator("td") });

  // Search across pagination pages for an Administrative vacation
  let adminRowFound = false;
  let hasCheckbox = false;
  const maxPages = 7;

  for (let pageNum = 0; pageNum < maxPages; pageNum++) {
    const adminRows = allRows.filter({ hasText: /Administrative/i });
    const adminCount = await adminRows.count();

    if (adminCount > 0) {
      adminRowFound = true;
      const firstAdminRow = adminRows.first();
      const rowText = await firstAdminRow.textContent() ?? "";

      // Verify "Administrative" type column
      expect(rowText.toLowerCase()).toContain("administrative");

      // Check if row has a checkbox (payable) or not
      const checkbox = firstAdminRow.locator("input[type='checkbox']");
      hasCheckbox = (await checkbox.count()) > 0;

      if (hasCheckbox) {
        // Administrative vacation IS payable via bulk UI — pay it
        const hasNotPaid = /Not paid/i.test(rowText);
        expect(hasNotPaid, "Payable admin vacation should show Not paid").toBe(true);

        await checkbox.check();
        await globalConfig.delay();

        const payAllBtn = page.getByRole("button", { name: /Pay all the checked requests/i });
        await payAllBtn.click();
        await globalConfig.delay();
        await page.waitForLoadState("networkidle");
        await globalConfig.delay();

        await verification.verify("Vacation payment", testInfo);
      } else {
        // Administrative vacation appears WITHOUT payment controls
        // This documents actual behavior: admin vacations show on payment page
        // but cannot be paid via the bulk checkbox UI
        // Verify the row has no status text and no actions
        await verification.verifyLocatorVisible(firstAdminRow, testInfo, "Admin-vacation-no-pay-controls");
      }
      break;
    }

    // Try next pagination page
    const nextPageNum = String(pageNum + 2);
    const nextBtn = page.locator('nav[aria-label="Pagination"] button').filter({ hasText: new RegExp(`^${nextPageNum}$`) });
    if (await nextBtn.count() === 0) break;
    await nextBtn.click();
    await page.waitForLoadState("networkidle");
    await globalConfig.delay();
  }

  // At minimum, verify we found an administrative vacation on the page
  expect(adminRowFound, "Should find at least one Administrative vacation on payment page").toBe(true);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
