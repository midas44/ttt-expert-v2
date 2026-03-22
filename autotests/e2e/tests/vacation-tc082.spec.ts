import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc082Data } from "../data/VacationTc082Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";

test("TC-VAC-082 - Admin role full access across pages @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc082Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // === Login as admin ===
  const login = new LoginFixture(page, tttConfig, data.adminLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // === Verify Calendar of absences dropdown has menu items ===
  const calendarMenuItem = page
    .locator(".page-header .navbar__list-item")
    .filter({ hasText: /Calendar of absences/i });
  const trigger = calendarMenuItem.locator(".navbar__item, .navbar__link");
  await trigger.first().click();
  await globalConfig.delay();

  // Check dropdown items using the same selectors as HeaderNavigationFixture
  const dropdownItems = page.locator(
    ".navbar__list-drop-item, .drop-down-menu__option",
  );
  const allTexts = await dropdownItems.allTextContents();

  const hasMyVacations = allTexts.some((t) => /My vacations/i.test(t));
  const hasEmployeeRequests = allTexts.some((t) => /Employees?\s*requests/i.test(t));
  expect(hasMyVacations, "Admin should see My vacations menu").toBe(true);
  expect(hasEmployeeRequests, "Admin should see Employee Requests menu").toBe(true);

  // Close dropdown
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await globalConfig.delay();

  // === Navigate to My vacations via direct URL ===
  await page.goto(tttConfig.buildUrl("/vacation/my"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  const myVacTitle = page.locator(".page-body__title").filter({ hasText: /My vacations/i });
  await expect(myVacTitle).toBeVisible();
  await verification.verify("My vacations", testInfo);

  // === Navigate to Employee Requests via direct URL ===
  await page.goto(tttConfig.buildUrl("/vacation/request"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  const requestsTitle = page.locator(".page-body__title").filter({ hasText: /Employees/i });
  await expect(requestsTitle).toBeVisible();
  await verification.verifyLocatorVisible(requestsTitle, testInfo, "Admin-EmployeeRequests");

  // === Navigate to Vacation Payment page (direct URL) ===
  await page.goto(tttConfig.buildUrl("/vacation/payment"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  const paymentTitle = page.locator("text=Vacation payment").first();
  await expect(paymentTitle).toBeVisible();
  await verification.verify("Vacation payment", testInfo);

  // === Navigate to Availability chart ===
  await page.goto(tttConfig.buildUrl("/vacation/chart"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  // Chart page should load without error
  const chartContent = page.locator(".page-body, [class*='chart']").first();
  await expect(chartContent).toBeVisible();
  await verification.verifyLocatorVisible(chartContent, testInfo, "Admin-Chart");

  // === Navigate to Vacation days ===
  await page.goto(tttConfig.buildUrl("/vacation/days"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  const daysContent = page.locator(".page-body").first();
  await expect(daysContent).toBeVisible();
  await verification.verifyLocatorVisible(daysContent, testInfo, "Admin-VacationDays");

  // === Navigate to Day correction ===
  await page.goto(tttConfig.buildUrl("/vacation/correction"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();
  const correctionContent = page.locator(".page-body").first();
  await expect(correctionContent).toBeVisible();
  await verification.verifyLocatorVisible(correctionContent, testInfo, "Admin-DayCorrection");

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
