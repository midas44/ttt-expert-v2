import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc074Data } from "../data/VacationTc074Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-074 - Employee can view own vacations only @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc074Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Verify My vacations page is accessible
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  await verification.verify("My vacations and days off", testInfo);

  // Verify "Employees requests" menu item is NOT visible
  // Open the Calendar of absences dropdown
  const calendarMenu = page.getByRole("button", {
    name: /Calendar of absences/i,
  });
  await calendarMenu.click();
  await globalConfig.delay();

  // Check that "Employees requests" is not in the dropdown
  const dropdownItems = page.locator(
    ".drop-down-menu a, .drop-down-menu__option, [class*='dropdown'] a",
  );
  const allTexts = await dropdownItems.allTextContents();
  const hasEmployeeRequests = allTexts.some((t) =>
    /Employees?\s*requests/i.test(t),
  );
  expect(
    hasEmployeeRequests,
    "Employees requests should NOT be in dropdown for regular employee",
  ).toBe(false);

  // Close the dropdown by clicking elsewhere
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await globalConfig.delay();

  // Attempt direct navigation to /vacation/request
  // Note: frontend does NOT redirect (known security gap) — backend returns 403 on API calls
  await page.goto(tttConfig.buildUrl("/vacation/request"));
  await page.waitForLoadState("networkidle");
  await globalConfig.delay();

  // Verify: either page redirected, or loaded but no approval actions available
  const currentUrl = page.url();
  if (currentUrl.includes("/vacation/request")) {
    // Frontend let the page load — verify no approval actions visible
    const approveBtn = page.locator('[data-testid="vacation-request-action-approve"]');
    const approveBtnCount = await approveBtn.count();
    expect(
      approveBtnCount,
      "Approve buttons should not be visible for regular employee",
    ).toBe(0);
  }
  // else: redirected away, which is also valid

  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
