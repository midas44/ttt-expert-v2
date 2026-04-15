import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc056Data } from "../../data/vacation/VacationTc056Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage } from "@ttt/pages/MainPage";
import { VacationDaysPage } from "@ttt/pages/VacationDaysPage";

/**
 * TC-VAC-056: Latin name search bug (#3297).
 * Bug: Latin name search on /vacation/vacation-days is broken — returns no results.
 * Cyrillic search for the same employee works correctly.
 * The backend GET /api/vacation/v1/employees?search= ignores the search parameter.
 */
test("TC-VAC-056: Latin name search bug (#3297) @regress @vacation @filters", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc056Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.managerLogin,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const daysPage = new VacationDaysPage(page);

  // Step 1: Login as manager, switch to English
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 2: Navigate to Employees Vacation Days page
  await page.goto(`${tttConfig.appUrl}/vacation/vacation-days`, {
    waitUntil: "domcontentloaded",
  });
  await daysPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Record initial row count (no filter)
  const initialCount = await daysPage.getVisibleRowCount();
  await verification.captureStep(testInfo, "initial-page-loaded");

  // Step 4: Search by Latin last name
  await daysPage.search(data.latinLastName);
  await globalConfig.delay();

  const latinCount = await daysPage.getVisibleRowCount();
  const latinFound = await daysPage.hasEmployeeRow(data.targetDisplayName);
  await verification.captureStep(testInfo, "latin-search-result");

  // Step 5: Clear and search by Cyrillic (Russian) last name
  await daysPage.clearSearch();
  await globalConfig.delay();
  await daysPage.search(data.russianLastName);
  await globalConfig.delay();

  const cyrillicCount = await daysPage.getVisibleRowCount();
  const cyrillicFound = await daysPage.hasEmployeeRow(data.russianLastName);
  await verification.captureStep(testInfo, "cyrillic-search-result");

  // Step 6: Verify bug #3297 behavior
  // Bug: Latin search returns all employees (search param ignored) or no match
  // Cyrillic search should work (employee found in results)

  // Cyrillic search should either filter to fewer results or show the employee
  // The backend returns all employees regardless, but client-side filtering may help
  expect(
    cyrillicCount,
    `Cyrillic search for "${data.russianLastName}" should return results`,
  ).toBeGreaterThan(0);

  // Latin search bug: either returns same count as no filter (search ignored)
  // or the employee is not found by Latin name
  const searchIgnored = latinCount === initialCount;
  const employeeNotFoundByLatin = !latinFound;

  expect(
    searchIgnored || employeeNotFoundByLatin,
    `Bug #3297: Expected Latin search for "${data.latinLastName}" to be broken ` +
      `(search ignored: ${searchIgnored}, employee not found: ${employeeNotFoundByLatin}). ` +
      `Latin count=${latinCount}, initial=${initialCount}`,
  ).toBeTruthy();

  await logout.runViaDirectUrl();
  await page.close();
});
