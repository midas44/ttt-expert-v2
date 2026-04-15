import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc002Data } from "../../data/vacation/VacationTc002Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-002: Create ADMINISTRATIVE (unpaid) vacation.
 * Verifies that checking "Unpaid vacation" creates an Administrative type request
 * and does NOT consume paid vacation balance.
 */
test("TC-VAC-002: Create ADMINISTRATIVE (unpaid) vacation @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc002Data.create(
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

  // Read available days before creation
  const daysBefore = await vacationsPage.getAvailableDays();
  await verification.captureStep(testInfo, "available-days-before");

  // Step 3-5: Open creation dialog, fill dates (single day)
  const dialog = await vacationsPage.openCreateRequest();
  await dialog.fillVacationPeriod(data.startInput, data.endInput);
  await globalConfig.delay();

  // Step 5: Check "Unpaid vacation" checkbox
  await dialog.ensureUnpaidVacationChecked();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "unpaid-checkbox-checked");

  // Step 7: Submit
  await dialog.submit();
  await globalConfig.delay();

  // Step 8: Verify vacation row appears with type "Administrative"
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  await expect(row).toHaveCount(1);
  const vacType = await vacationsPage.columnValue(
    data.periodPattern,
    "Vacation type",
  );
  expect(vacType.toLowerCase()).toContain("administrative");
  await verification.captureStep(testInfo, "vacation-type-administrative");

  // Step 9: Verify available days did NOT decrease
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(daysAfter).toBe(daysBefore);
  await verification.captureStep(testInfo, "available-days-unchanged");

  // CLEANUP: Delete the created vacation via UI
  const detailsDialog = await vacationsPage.openRequestDetails(data.periodPattern);
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();
});
