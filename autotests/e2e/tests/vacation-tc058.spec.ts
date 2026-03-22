import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc058Data } from "../data/VacationTc058Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationCreationFixture } from "../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../fixtures/VacationDeletionFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-058 - Verify FIFO day consumption (earliest year first) @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc058Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.employeeLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const vacationCreation = new VacationCreationFixture(page, globalConfig);
  const vacationDeletion = new VacationDeletionFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Navigate to My vacations
  await page.goto(tttConfig.buildUrl("/vacation/my"));
  await vacationsPage.waitForReady();

  // Cleanup leftover from previous runs
  await vacationDeletion.deleteVacationIfPresent({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  // Refresh page after cleanup
  await page.goto(tttConfig.buildUrl("/vacation/my"));
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // === Read yearly breakdown BEFORE vacation creation ===
  await vacationsPage.toggleYearlyBreakdown();
  const entriesBefore = await vacationsPage.getYearlyBreakdownEntries();
  expect(entriesBefore.length, "Should have multi-year balance").toBeGreaterThanOrEqual(2);

  // Sort by year to identify earliest
  const sortedBefore = [...entriesBefore].sort(
    (a, b) => parseInt(a.year) - parseInt(b.year),
  );
  const earliestYearBefore = sortedBefore[0];

  // Close the tooltip by clicking elsewhere
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await globalConfig.delay();

  // === Create a short regular vacation (3 working days) ===
  await vacationCreation.createVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });
  await globalConfig.delay();

  // === Read yearly breakdown AFTER vacation creation ===
  await vacationsPage.toggleYearlyBreakdown();
  const entriesAfter = await vacationsPage.getYearlyBreakdownEntries();

  // Find the earliest year's entry after creation
  const sortedAfter = [...entriesAfter].sort(
    (a, b) => parseInt(a.year) - parseInt(b.year),
  );

  // FIFO: earliest year should have fewer or equal days (consumed first)
  // If earliest year had enough days, it absorbs the full deduction
  // If not, it goes to 0 and remaining spills into next year
  const earliestAfter = sortedAfter.find((e) => e.year === earliestYearBefore.year);
  if (earliestAfter) {
    expect(
      parseInt(earliestAfter.days),
      `Earliest year (${earliestYearBefore.year}) should decrease — FIFO consumption`,
    ).toBeLessThan(parseInt(earliestYearBefore.days));
  } else {
    // Earliest year was fully consumed (removed from breakdown)
    // Verify next year decreased instead
    expect(sortedAfter.length).toBeLessThan(sortedBefore.length);
  }

  // Close tooltip
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await globalConfig.delay();

  await verification.verify("My vacations", testInfo);

  // === Cleanup: delete the created vacation ===
  await vacationDeletion.deleteVacation({
    startInput: data.startDate,
    endInput: data.endDate,
    periodPattern: data.periodPattern,
  });

  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
