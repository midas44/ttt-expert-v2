import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc001Data } from "../../data/vacation/VacationTc001Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-001: Create REGULAR vacation — happy path.
 * Verifies that an employee can create a regular (paid) vacation via the UI.
 * Expected: vacation created with status NEW, available days decrease.
 */
test("TC-VAC-001: Create REGULAR vacation — happy path @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc001Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // Step 1-2: Login, switch to English, navigate to My Vacations
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

  // Step 3: Read available days before creation
  const daysBefore = await vacationsPage.getAvailableDays();
  expect(daysBefore).toBeGreaterThanOrEqual(5);
  await verification.captureStep(testInfo, "available-days-before");

  // Step 4-9: Open creation dialog and fill
  const dialog = await vacationsPage.openCreateRequest();
  await dialog.fillVacationPeriod(data.startInput, data.endInput);
  await globalConfig.delay();

  // Step 6: Verify days auto-calculated
  const numberOfDays = await dialog.getNumberOfDays();
  expect(parseInt(numberOfDays, 10)).toBeGreaterThanOrEqual(4); // 4-5 depending on holidays

  // Step 8: Leave unpaid unchecked (REGULAR by default)
  await dialog.assertNoRedText();
  await verification.captureStep(testInfo, "dialog-filled");

  // Step 10: Submit
  await dialog.submit();
  await globalConfig.delay();

  // Step 11-12: Verify vacation row appears with status New
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  await expect(row).toHaveCount(1);
  const status = await vacationsPage.columnValue(data.periodPattern, "Status");
  expect(status.toLowerCase()).toContain("new");
  await verification.captureStep(testInfo, "vacation-created-new");

  // Step 13: Verify available days decreased
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(daysAfter).toBeLessThan(daysBefore);

  // CLEANUP: Delete the created vacation via UI
  const detailsDialog = await vacationsPage.openRequestDetails(data.periodPattern);
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();
});
