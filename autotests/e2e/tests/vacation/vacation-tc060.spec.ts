import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc060Data } from "../../data/vacation/VacationTc060Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { VacationCreationFixture } from "../../fixtures/VacationCreationFixture";
import { VacationDeletionFixture } from "../../fixtures/VacationDeletionFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-060: FIFO day consumption — earliest year first.
 * Creates a vacation for an employee with multi-year balance,
 * then verifies the per-year breakdown shows earliest year consumed first.
 */
test("TC-VAC-060: FIFO day consumption — earliest year first @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc060Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const mainPage = new MainPage(page);

  // Step 1: Login as the multi-year balance employee
  await login.run();
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 2: Navigate to /vacation/my
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Click info icon — note per-year breakdown BEFORE vacation creation
  await vacationsPage.toggleYearlyBreakdown();
  await globalConfig.delay();

  const entriesBefore = await vacationsPage.getYearlyBreakdownWithFallback();
  await verification.captureStep(testInfo, "yearly-breakdown-before");

  // Verify we have multi-year entries
  expect(entriesBefore.length).toBeGreaterThanOrEqual(2);

  // Record earliest year's balance before
  const sortedBefore = [...entriesBefore].sort(
    (a, b) => parseInt(a.year) - parseInt(b.year),
  );
  const earliestBefore = sortedBefore[0];
  const earliestDaysBefore = parseInt(earliestBefore.days, 10);

  // Close tooltip before creating vacation
  await vacationsPage.toggleYearlyBreakdown().catch(() => {});
  await globalConfig.delay();

  // Step 4: Create a REGULAR vacation consuming some days
  const creationFixture = new VacationCreationFixture(page, globalConfig);
  const deletionFixture = new VacationDeletionFixture(page, globalConfig);

  try {
    await creationFixture.createVacation({
      startInput: data.startInput,
      endInput: data.endInput,
      periodPattern: data.periodPattern,
    });
    await verification.captureStep(testInfo, "vacation-created");

    // Step 5: After creation, click info icon again
    await vacationsPage.toggleYearlyBreakdown();
    await globalConfig.delay();

    const entriesAfter = await vacationsPage.getYearlyBreakdownWithFallback();
    await verification.captureStep(testInfo, "yearly-breakdown-after");

    // Step 6: Verify earliest year's balance decreased first (FIFO)
    const sortedAfter = [...entriesAfter].sort(
      (a, b) => parseInt(a.year) - parseInt(b.year),
    );

    const earliestAfter = sortedAfter.find(
      (e) => e.year === earliestBefore.year,
    );

    if (earliestAfter) {
      const earliestDaysAfter = parseInt(earliestAfter.days, 10);
      // FIFO: earliest year should have decreased (or been fully consumed)
      expect(earliestDaysAfter).toBeLessThan(earliestDaysBefore);
    } else {
      // Earliest year entry gone → fully consumed. Valid FIFO behavior.
      expect(earliestDaysBefore).toBeGreaterThan(0);
    }

    // CLEANUP: Delete the created vacation via UI
    await deletionFixture.deleteVacationIfPresent({
      startInput: data.startInput,
      endInput: data.endInput,
      periodPattern: data.periodPattern,
    });
  } catch (error) {
    await deletionFixture
      .deleteVacationIfPresent({
        startInput: data.startInput,
        endInput: data.endInput,
        periodPattern: data.periodPattern,
      })
      .catch(() => {});
    throw error;
  }

  await logout.runViaDirectUrl();
  await page.close();
});
