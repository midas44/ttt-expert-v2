import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc012Data } from "../data/VacationTc012Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-012 - Verify total row in vacation table @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc012Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations → "All" tab
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await vacationsPage.clickAllTab();
  await globalConfig.delay();

  // Step 3: Verify total row exists in the table footer
  // The total row is the last row in the table (tfoot or last tbody row)
  const totalRow = page.locator(
    "table tfoot tr, table tbody tr:last-child",
  ).filter({ hasText: /total/i });
  await expect(totalRow.first()).toBeVisible();

  // Step 4: Read all Regular days and Administrative days from data rows
  const regularDaysTexts = await vacationsPage.getColumnTexts("Regular days");
  const adminDaysTexts = await vacationsPage.getColumnTexts("Administrative days");

  // Sum the visible data row values
  const sumRegular = regularDaysTexts.reduce((acc, text) => {
    const num = parseInt(text, 10);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);
  const sumAdmin = adminDaysTexts.reduce((acc, text) => {
    const num = parseInt(text, 10);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

  // Step 5: Read the total row values
  const totalRowCells = await totalRow.first().locator("td, th").allTextContents();
  // Find cells that contain numbers — total row typically has sums in the Regular and Admin columns
  const totalNumbers = totalRowCells
    .map((t) => parseInt(t.trim(), 10))
    .filter((n) => !isNaN(n));

  // Verify at least one total number matches our computed sums
  expect(
    totalNumbers.includes(sumRegular) || totalNumbers.includes(sumAdmin),
    `Total row should contain computed sums. Regular=${sumRegular}, Admin=${sumAdmin}, Total cells=${totalNumbers.join(",")}`,
  ).toBeTruthy();

  await verification.verifyLocatorVisible(
    totalRow.first(),
    testInfo,
    "total-row-visible",
  );

  await logout.runViaDirectUrl();
  await page.close();
});
