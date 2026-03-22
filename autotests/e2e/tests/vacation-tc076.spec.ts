import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc076Data } from "../data/VacationTc076Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";

test("TC-VAC-076 - Accountant can access Payment page @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc076Data.create(
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

  // === Verify "Accounting" menu is visible in navigation ===
  const accountingMenu = page.locator("a, button, [role='menuitem'], .navbar__link")
    .filter({ hasText: /^Accounting$/i });
  expect(await accountingMenu.count()).toBeGreaterThan(0);

  // === Navigate to Vacation Payment page ===
  await page.goto(tttConfig.buildUrl("/vacation/payment"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Verify payment page loaded
  await expect(page.locator("text=Vacation payment").first()).toBeVisible();

  // === Verify payment table loads ===
  // Wait for any cell with "Not paid" or employee link to appear
  await page.locator("table tbody td").first().waitFor({ state: "attached", timeout: 10000 });
  await globalConfig.delay();
  const tableRows = page.locator("table tbody tr").filter({ has: page.locator("td") });
  const rowCount = await tableRows.count();
  expect(rowCount).toBeGreaterThan(0);

  // === Verify pay action: checkboxes and "Pay all" button exist ===
  const checkboxes = page.locator("table tbody input[type='checkbox']");
  expect(await checkboxes.count()).toBeGreaterThan(0);

  const payAllBtn = page.getByRole("button", { name: /Pay all the checked requests/i });
  expect(await payAllBtn.count()).toBe(1);

  // === Verify screenshot ===
  const verification = new VerificationFixture(page, globalConfig);
  await verification.verify("Vacation payment", testInfo);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
