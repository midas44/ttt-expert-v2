import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc008Data } from "../../data/vacation/VacationTc008Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-008: Cancel an APPROVED vacation.
 * SETUP: Creates and approves a vacation via API (future dates, 4+ weeks ahead).
 * Test cancels it via UI and verifies days are returned to the balance.
 *
 * The canBeCancelled guard requires paymentDate to be in the future relative
 * to the current report period — using dates 4+ weeks ahead ensures this.
 */
test("TC-VAC-008: Cancel APPROVED vacation @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc008Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create and approve vacation via API
  await setup.createAndApprove(data.startDateIso, data.endDateIso);

  // Step 1-2: Login, switch to English, navigate
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Note available days before cancellation
  const daysBefore = await vacationsPage.getAvailableDays();
  await verification.captureStep(testInfo, "before-cancel");

  // Step 4-5: Find APPROVED vacation and open details
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  const statusBefore = await vacationsPage.columnValue(
    data.periodPattern,
    "Status",
  );
  expect(statusBefore.toLowerCase()).toContain("approved");

  // Step 6-7: Open details and delete/cancel
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  // Step 8: Verify vacation moves to Closed tab
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();

  const closedRow = await vacationsPage.waitForVacationRow(
    data.periodPattern,
  );
  await expect(closedRow).toHaveCount(1);
  const closedStatus = await vacationsPage.columnValue(
    data.periodPattern,
    "Status",
  );
  expect(closedStatus.toLowerCase()).toMatch(/cancel|delet/);
  await verification.captureStep(testInfo, "vacation-canceled-in-closed");

  // Step 9: Verify available days increased (days returned to pool)
  await vacationsPage.clickOpenTab();
  await globalConfig.delay();
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(daysAfter).toBeGreaterThan(daysBefore);
  await verification.captureStep(testInfo, "days-restored-after-cancel");

  // No CLEANUP needed — vacation is already canceled
  await logout.runViaDirectUrl();
  await page.close();
});
