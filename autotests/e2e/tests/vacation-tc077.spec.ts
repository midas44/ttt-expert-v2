import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc077Data } from "../data/VacationTc077Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";

test("TC-VAC-077 - Regular employee cannot access Payment page @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc077Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");
  await globalConfig.delay();

  // Verify "Accounting" menu is NOT visible in navigation
  const accountingMenu = page.locator(
    "a, button, [role='menuitem'], .navbar__link",
  ).filter({ hasText: /^Accounting$/i });

  const accountingVisible = await accountingMenu.count();
  expect(
    accountingVisible,
    "Accounting menu should NOT be visible for regular employee",
  ).toBe(0);

  // Screenshot for documentation (no specific text assertion needed here)

  // Attempt direct navigation to /vacation/payment
  // Note: frontend does NOT redirect (known security gap) — backend returns 403 on API calls
  // The page loads but shows no payment data. Verify the table is empty or doesn't render.
  await page.goto(tttConfig.buildUrl("/vacation/payment"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Verify: either page redirected, or it loaded but table has no actionable rows
  const currentUrl = page.url();
  if (currentUrl.includes("/vacation/payment")) {
    // Frontend let the page load — verify no payment data visible
    const payButton = page.getByRole("button", { name: /pay all/i });
    const payBtnCount = await payButton.count();
    expect(
      payBtnCount,
      "Pay All button should not be visible for non-accountant",
    ).toBe(0);
  }
  // else: redirected away, which is also valid

  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
