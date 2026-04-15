import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc061Data } from "../../data/vacation/VacationTc061Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-061: FIFO redistribution on cancel — days returned.
 * SETUP: Creates and approves a vacation via API (as pvaynmaster who self-approves).
 * Test checks per-year breakdown before and after cancel to verify days return.
 * Recalculation returns ALL regular days to balance then re-distributes via FIFO.
 */
test("TC-VAC-061: FIFO redistribution on cancel — days returned @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc061Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const mainPage = new MainPage(page);

  // SETUP: Create and approve vacation via API
  await setup.createAndApprove(data.startDateIso, data.endDateIso);

  // Step 1: Login as the employee (pvaynmaster)
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

  // Step 3: Click info icon — note per-year breakdown (reduced by APPROVED vacation)
  await vacationsPage.toggleYearlyBreakdown();
  await globalConfig.delay();

  const entriesReduced = await vacationsPage.getYearlyBreakdownWithFallback();
  await verification.captureStep(testInfo, "yearly-breakdown-reduced");

  const totalReduced = entriesReduced.reduce(
    (sum, e) => sum + parseInt(e.days, 10),
    0,
  );

  // Close tooltip
  await vacationsPage.toggleYearlyBreakdown().catch(() => {});
  await globalConfig.delay();

  // Step 4: Cancel the vacation via UI (details dialog → delete/cancel)
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  await expect(row).toHaveCount(1);

  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  // Verify vacation moves to Closed tab
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await verification.captureStep(testInfo, "vacation-canceled");

  // Step 5: Click info icon again to check per-year breakdown after cancel
  await vacationsPage.toggleYearlyBreakdown();
  await globalConfig.delay();

  const entriesAfterCancel =
    await vacationsPage.getYearlyBreakdownWithFallback();
  await verification.captureStep(testInfo, "yearly-breakdown-after-cancel");

  // Step 6: Verify days returned — total after cancel > total while APPROVED
  const totalAfterCancel = entriesAfterCancel.reduce(
    (sum, e) => sum + parseInt(e.days, 10),
    0,
  );
  expect(totalAfterCancel).toBeGreaterThan(totalReduced);

  // Verify the total is close to the original balance (±1 day for rounding)
  expect(totalAfterCancel).toBeGreaterThanOrEqual(
    data.totalAvailableDays - 1,
  );

  // No CLEANUP needed — vacation is already canceled
  await logout.runViaDirectUrl();
  await page.close();
});
