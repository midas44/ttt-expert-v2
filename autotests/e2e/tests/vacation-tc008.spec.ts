import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc008Data } from "../data/VacationTc008Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-008 - Verify vacation table columns and sorting @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc008Data.create(
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

  // Step 2: Navigate to My vacations and days off
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Click "All" tab to see all vacations
  await vacationsPage.clickAllTab();
  await globalConfig.delay();

  // Step 4: Verify all expected column headers are present
  const expectedColumns = [
    "Vacation dates",
    "Regular days",
    "Administrative days",
    "Vacation type",
    "Approved by",
    "Status",
    "Payment month",
    "Actions",
  ];
  for (const col of expectedColumns) {
    await expect(
      page.locator("table thead th").filter({ hasText: col }),
    ).toBeVisible();
  }
  await verification.verifyLocatorVisible(
    page.locator("table thead"),
    testInfo,
    "all-columns-visible",
  );

  // Step 5: Read initial row order (Vacation dates column)
  const datesBefore = await vacationsPage.getColumnTexts("Vacation dates");
  expect(datesBefore.length).toBeGreaterThanOrEqual(3);

  // Step 6: Click "Vacation dates" to sort ascending
  await vacationsPage.clickColumnSort("Vacation dates");
  await globalConfig.delay();
  const datesAsc = await vacationsPage.getColumnTexts("Vacation dates");

  // Step 7: Click again to sort descending
  await vacationsPage.clickColumnSort("Vacation dates");
  await globalConfig.delay();
  const datesDesc = await vacationsPage.getColumnTexts("Vacation dates");

  // Verify sort order changed between ascending and descending
  expect(datesAsc[0]).not.toBe(datesDesc[0]);

  // Step 8: Sort by Status column
  await vacationsPage.clickColumnSort("Status");
  await globalConfig.delay();
  const statusAsc = await vacationsPage.getColumnTexts("Status");
  expect(statusAsc.length).toBeGreaterThan(0);

  // Click again to reverse
  await vacationsPage.clickColumnSort("Status");
  await globalConfig.delay();
  const statusDesc = await vacationsPage.getColumnTexts("Status");

  // Verify status sort toggles (first element should differ if there are mixed statuses)
  if (statusAsc.length > 1) {
    const ascJoined = statusAsc.join(",");
    const descJoined = statusDesc.join(",");
    expect(ascJoined).not.toBe(descJoined);
  }

  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(/.+/).first(),
    testInfo,
    "sorting-verified",
  );

  await logout.runViaDirectUrl();
  await page.close();
});
