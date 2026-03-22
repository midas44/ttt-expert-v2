import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc005Data } from "../data/VacationTc005Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-005 - View vacation request details @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc005Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations and days off
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Find the vacation row
  await vacationsPage.waitForVacationRow(data.periodPattern);

  // Step 4: Open request details via "..." action button
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );

  // Step 5: Verify key fields are displayed in the details dialog
  const dialogRoot = detailsDialog.root();
  await expect(dialogRoot).toContainText(/Number of days/i);
  await expect(dialogRoot).toContainText(/Status/i);
  await expect(dialogRoot).toContainText(/(Regular|Administrative)/i);
  await expect(dialogRoot).toContainText(/Approved by/i);

  await verification.verifyLocatorVisible(
    dialogRoot,
    testInfo,
    "details-dialog-fields",
  );

  // Step 6: Close dialog
  await detailsDialog.close();

  // Step 7: Verify table is unchanged — vacation row still visible
  await vacationsPage.waitForVacationRow(data.periodPattern);

  await logout.runViaDirectUrl();
  await page.close();
});
