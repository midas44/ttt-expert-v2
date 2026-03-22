import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc009Data } from "../data/VacationTc009Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-009 - Verify vacation table filters — status and type @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc009Data.create(
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

  // Step 2: Navigate to My vacations and days off → "All" tab
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();
  await vacationsPage.clickAllTab();
  await globalConfig.delay();

  const allRowsBefore = await vacationsPage.getRowCount();
  expect(allRowsBefore).toBeGreaterThan(0);

  // Step 3: Open "Vacation type" filter
  await vacationsPage.openColumnFilter("Vacation type");
  await globalConfig.delay();

  // Step 4: Verify filter checkboxes exist
  await expect(page.getByRole("checkbox", { name: "All" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Regular" })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Administrative" }),
  ).toBeVisible();

  // Step 5: Uncheck "All", then check only "Administrative"
  // Filter applies in real-time while dropdown is open — no need to close
  await vacationsPage.toggleFilterCheckbox("All");
  await page.waitForTimeout(500);
  await vacationsPage.toggleFilterCheckbox("Administrative");
  await page.waitForTimeout(1000); // Wait for React table re-render

  // Step 6: Verify table shows only Administrative vacations
  const typeValues = await vacationsPage.getColumnTexts("Vacation type");
  expect(typeValues.length).toBeGreaterThan(0);
  for (const typeVal of typeValues) {
    expect(typeVal).toBe("Administrative");
  }

  // Close dropdown by pressing Escape
  await page.keyboard.press("Escape");
  await globalConfig.delay();

  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(/.+/).first(),
    testInfo,
    "filter-administrative-only",
  );

  // Step 7: Reset table by re-clicking the "All" tab (clears all filters)
  await vacationsPage.clickAllTab();
  await globalConfig.delay();

  // Step 8: Read status values to pick one for filtering
  const allStatuses = await vacationsPage.getColumnTexts("Status");
  expect(allStatuses.length).toBeGreaterThan(0);
  const targetStatus = allStatuses[0];

  // Step 9: Open "Status" filter
  await vacationsPage.openColumnFilter("Status");
  await globalConfig.delay();

  // Step 10: Verify status filter checkboxes present
  await expect(page.getByRole("checkbox", { name: "All" })).toBeVisible();

  // Step 11: Uncheck "All", check only the target status
  await vacationsPage.toggleFilterCheckbox("All");
  await page.waitForTimeout(500);
  await vacationsPage.toggleFilterCheckbox(targetStatus);
  await page.waitForTimeout(1000); // Wait for React table re-render

  // Step 12: Verify table shows only the target status vacations
  const statusValues = await vacationsPage.getColumnTexts("Status");
  expect(statusValues.length).toBeGreaterThan(0);
  for (const status of statusValues) {
    expect(status).toBe(targetStatus);
  }

  // Close dropdown by pressing Escape
  await page.keyboard.press("Escape");
  await globalConfig.delay();

  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(/.+/).first(),
    testInfo,
    `filter-${targetStatus.toLowerCase()}-status-only`,
  );

  await logout.runViaDirectUrl();
  await page.close();
});
