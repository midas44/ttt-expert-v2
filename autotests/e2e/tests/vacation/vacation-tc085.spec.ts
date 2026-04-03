import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc085Data } from "../../data/vacation/VacationTc085Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-085: Owner can edit own vacation (not PAID).
 * SETUP: Creates a NEW vacation via API.
 * Test: Verifies edit button is visible, edits end date, saves successfully.
 * Permission: EDIT allowed for owner when status is not PAID.
 */
test("TC-VAC-085: Owner can edit own vacation (not PAID) @regress @vacation @permissions", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc085Data.create(globalConfig.testDataMode, tttConfig);
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create vacation via API
  const vacation = await setup.createVacation(data.startDateIso, data.endDateIso);

  try {
    // Step 1-2: Login, switch to English, navigate
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }
    await page.goto(`${tttConfig.appUrl}/vacation/my`, { waitUntil: "domcontentloaded" });
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Find the NEW vacation row and verify edit button exists
    await vacationsPage.waitForVacationRow(data.periodPattern);
    const buttonCount = await vacationsPage.getActionButtonCount(data.periodPattern);
    expect(buttonCount).toBeGreaterThanOrEqual(2); // edit + details at minimum
    await verification.captureStep(testInfo, "edit-button-visible");

    // Step 4-5: Click edit, change end date
    const dialog = await vacationsPage.openEditDialog(data.periodPattern);
    await dialog.selectEndDate(data.newEndInput);
    await globalConfig.delay();

    // Step 6: Submit and verify success
    await dialog.submit();
    await globalConfig.delay();

    // Step 7: Verify updated vacation row with new period
    const row = await vacationsPage.waitForVacationRow(data.newPeriodPattern);
    await expect(row).toHaveCount(1);
    await verification.captureStep(testInfo, "vacation-edited-successfully");
  } finally {
    // CLEANUP: Delete the vacation via API
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
