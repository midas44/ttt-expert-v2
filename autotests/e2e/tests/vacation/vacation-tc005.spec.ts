import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc005Data } from "../../data/vacation/VacationTc005Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-005: Edit vacation dates (NEW status).
 * SETUP: Creates a Mon–Fri vacation via API, then extends the end date
 * by one week via the UI edit dialog. Verifies day count recalculates.
 */
test("TC-VAC-005: Edit vacation dates (NEW status) @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc005Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create NEW vacation via API
  const vacation = await setup.createVacation(
    data.startDateIso,
    data.endDateIso,
  );

  try {
    // Step 1-3: Login, switch to English, navigate
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

    // Step 3: Find the NEW vacation row
    await vacationsPage.waitForVacationRow(data.periodPattern);
    await verification.captureStep(testInfo, "vacation-before-edit");

    // Step 4-5: Open edit dialog
    const dialog = await vacationsPage.openEditDialog(data.periodPattern);

    // Step 6: Change end date to one week later
    await dialog.fillVacationPeriod(data.startInput, data.newEndInput);
    await globalConfig.delay();

    // Step 7: Verify day count recalculates (should be ~10 days for 2 weeks)
    const numberOfDays = await dialog.getNumberOfDays();
    expect(parseInt(numberOfDays, 10)).toBeGreaterThanOrEqual(8); // 8-10 depending on holidays
    await verification.captureStep(testInfo, "dialog-extended-dates");

    // Step 8: Submit
    await dialog.submit();
    await globalConfig.delay();

    // Step 9: Verify vacation row updates with new dates
    const row = await vacationsPage.waitForVacationRow(data.newPeriodPattern);
    await expect(row).toHaveCount(1);

    // Step 10: Verify status remains "New"
    const status = await vacationsPage.columnValue(
      data.newPeriodPattern,
      "Status",
    );
    expect(status.toLowerCase()).toContain("new");
    await verification.captureStep(testInfo, "vacation-edited-new-dates");
  } finally {
    // CLEANUP: Delete the vacation
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
