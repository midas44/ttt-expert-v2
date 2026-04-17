import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc004Data } from "../../data/vacation/VacationTc004Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-004: Create vacation with 'Also notify' recipients.
 * Verifies that selecting a colleague in the "Also notify" field during
 * creation persists the notification relationship (verified via DB).
 */
test("TC-VAC-004: Create vacation with Also notify recipients @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc004Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

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

  // Step 3: Open creation dialog and fill dates
  const dialog = await vacationsPage.openCreateRequest();
  await dialog.fillVacationPeriod(data.startInput, data.endInput);
  await globalConfig.delay();

  // Step 4: Select colleague in "Also notify" field
  await dialog.fillAlsoNotify(data.colleagueLogin, data.colleagueName);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "dialog-with-notify");

  // Step 5: Submit
  await dialog.submit();
  await globalConfig.delay();

  // Step 6: Verify vacation created
  const row = await vacationsPage.waitForVacationRow(data.periodPattern);
  await expect(row).toHaveCount(1);
  const status = await vacationsPage.columnValue(data.periodPattern, "Status");
  expect(status.toLowerCase()).toContain("new");
  await verification.captureStep(testInfo, "vacation-created-with-notify");

  // DB-CHECK: Verify notify-also record was saved
  const notifyCount = await data.verifyNotifyAlso(tttConfig);
  expect(notifyCount).toBeGreaterThanOrEqual(1);

  // CLEANUP: Delete the created vacation via UI
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();
});
