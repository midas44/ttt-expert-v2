import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc071Data } from "../data/VacationTc071Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { AvailabilityChartPage } from "../pages/AvailabilityChartPage";

test("TC-VAC-071 - Verify chart search by employee @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc071Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // Step 1: Login as department manager
  const login = new LoginFixture(page, tttConfig, data.viewerLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Availability chart
  await page.goto(tttConfig.buildUrl("/vacation/chart"));
  const chartPage = new AvailabilityChartPage(page);
  await chartPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Record initial employee count
  const initialCount = await chartPage.getEmployeeRowCount();
  expect(initialCount, "Chart should show employees").toBeGreaterThan(1);

  // Step 4: Type employee last name in search box
  const searchBox = chartPage.searchBox();
  await searchBox.click();
  await searchBox.pressSequentially(data.searchLastName, { delay: 50 });
  await page.waitForTimeout(2000); // Wait for search filter to apply

  // Step 5: Verify chart filters to show matching employees
  // Search matches name, project, manager, salary office — so non-name matches are expected
  const filteredNames = await chartPage.getEmployeeNames();
  const filteredCount = filteredNames.length;
  expect(filteredCount, "Search should return results").toBeGreaterThan(0);

  // Verify the target employee appears in filtered results
  const targetFound = filteredNames.some((n) =>
    n.toLowerCase().includes(data.searchLastName.toLowerCase()),
  );
  expect(
    targetFound,
    `Employee "${data.searchLastName}" should appear in search results`,
  ).toBe(true);

  await verification.verify("Availability chart", testInfo);

  // Step 6: Clear search
  await searchBox.click();
  await searchBox.fill("");
  await page.waitForTimeout(2000); // Wait for filter to clear

  // Step 7: Verify all employees are shown again
  const restoredCount = await chartPage.getEmployeeRowCount();
  expect(
    restoredCount,
    "Clearing search should restore all employees",
  ).toBeGreaterThanOrEqual(initialCount);

  await verification.verify("Availability chart", testInfo);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
