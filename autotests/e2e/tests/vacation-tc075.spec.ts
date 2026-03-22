import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc075Data } from "../data/VacationTc075Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { EmployeeRequestsPage } from "../pages/EmployeeRequestsPage";

test("TC-VAC-075 - Manager can view and act on Employee Requests @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc075Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // === Login as project manager ===
  const login = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  await login.run();
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  await mainFixture.ensureLanguage("EN");

  // === Verify "Calendar of absences" dropdown contains "Employees' requests" ===
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  // Open the Calendar of absences dropdown
  const calendarItem = page
    .locator(".page-header .navbar__list-item")
    .filter({ hasText: "Calendar of absences" });
  const calendarTrigger = calendarItem.locator(".navbar__item, .navbar__link");
  await calendarTrigger.first().click();
  await globalConfig.delay();

  // Check submenu items include Employees' requests
  const submenuItems = page.locator(
    ".navbar__list-drop-item, .drop-down-menu__option",
  );
  const allTexts = await submenuItems.allTextContents();
  const hasEmployeeRequests = allTexts.some((t) =>
    /Employees?\s*'?\s*requests/i.test(t),
  );
  expect(hasEmployeeRequests).toBe(true);

  // === Navigate to Employees' requests via dropdown ===
  const empRequestsItem = submenuItems.filter({
    hasText: /Employees?\s*'?\s*requests/i,
  });
  await empRequestsItem.first().click();
  await page.waitForLoadState("networkidle");

  const requestsPage = new EmployeeRequestsPage(page);
  await requestsPage.waitForReady();
  await globalConfig.delay();

  // === Verify Approval tab loads with requests ===
  await requestsPage.clickApprovalTab();
  await globalConfig.delay();

  // Table should have at least one row
  const rows = page.locator("table tbody tr").filter({ has: page.locator("td") });
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  // === Verify action buttons exist on requests ===
  // Action buttons are in the last cell of each row — look for icon buttons
  const firstRow = rows.first();
  const actionButtons = firstRow.locator("button, a").filter({
    has: page.locator("img, svg, [class*='icon']"),
  });
  expect(await actionButtons.count()).toBeGreaterThan(0);

  // === Verify screenshot ===
  const verification = new VerificationFixture(page, globalConfig);
  await verification.verify("Employees' requests", testInfo);

  // === Logout ===
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
