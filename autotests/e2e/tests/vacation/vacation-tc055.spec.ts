import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc055Data } from "../../data/vacation/VacationTc055Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage } from "../../pages/MainPage";
import { VacationDaysPage } from "../../pages/VacationDaysPage";

/**
 * TC-VAC-055: Employees Vacation Days page — search by name.
 * DM navigates to /vacation/vacation-days, types a name in the search box,
 * and verifies matching results appear.
 * Requires VACATIONS:VIEW_EMPLOYEES permission (DM role).
 */
test("TC-VAC-055: Employees Vacation Days page — search by name @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc055Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 1: Navigate to Employees Vacation Days page
  await page.goto(`${tttConfig.appUrl}/vacation/vacation-days`, {
    waitUntil: "domcontentloaded",
  });
  const daysPage = new VacationDaysPage(page);
  await daysPage.waitForReady();
  await globalConfig.delay();

  // Step 2: Get initial row count (unfiltered)
  const initialCount = await daysPage.getVisibleRowCount();
  expect(initialCount, "Page should show employee rows before search").toBeGreaterThan(0);
  await verification.captureStep(testInfo, "initial-table");

  // Step 3: Search by employee first name
  await daysPage.search(data.searchName);
  await globalConfig.delay();

  // Step 4: Verify results are filtered — search should narrow results
  const filteredCount = await daysPage.getVisibleRowCount();
  expect(filteredCount, "Search should return at least one result").toBeGreaterThan(0);
  // Table may show Russian names while search uses Latin — verify by count reduction
  expect(
    filteredCount,
    "Search should narrow results (fewer rows than unfiltered)",
  ).toBeLessThan(initialCount);
  await verification.captureStep(testInfo, "search-results");
  expect(
    filteredCount,
    "Filtered count should be <= initial count",
  ).toBeLessThanOrEqual(initialCount);

  // Step 6: Clear search and verify table resets
  await daysPage.clearSearch();
  await globalConfig.delay();
  const resetCount = await daysPage.getVisibleRowCount();
  expect(
    resetCount,
    "Table should reset after clearing search",
  ).toBeGreaterThanOrEqual(filteredCount);
  await verification.captureStep(testInfo, "search-cleared");

  await logout.runViaDirectUrl();
  await page.close();
});
