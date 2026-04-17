import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc073Data } from "../../data/vacation/VacationTc073Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-073: Regression — Edit own vacation shows 0 available (#3014-21).
 * SETUP: Creates a vacation via API consuming 5 working days.
 * Test: Opens edit dialog, verifies available days shown EXCLUDES the current
 * vacation's days from consumed total (should NOT show 0 or artificially low value).
 * Bug #3014-21 (fixed): previously showed 0 available when editing.
 */
test("TC-VAC-073: Edit own vacation shows 0 available (#3014-21) @regress @vacation @regression", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc073Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create vacation via API
  const vacation = await setup.createVacation(
    data.startDateIso,
    data.endDateIso,
  );

  try {
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

    // Step 3: Read available days before edit
    const availableBefore = await vacationsPage.getAvailableDays();
    await verification.captureStep(testInfo, "available-days-before-edit");

    // Step 4: Open edit dialog on the vacation
    await vacationsPage.waitForVacationRow(data.periodPattern);
    const dialog = await vacationsPage.openEditDialog(data.periodPattern);
    await globalConfig.delay();

    // Step 5: Read the "Number of days" shown in the edit dialog
    const daysInDialog = await dialog.getNumberOfDays();
    await verification.captureStep(testInfo, "edit-dialog-opened");

    // Step 6: Verify available days in edit dialog are NOT 0
    // The available days header should reflect original balance minus OTHER vacations,
    // excluding the vacation being edited.
    // After opening edit dialog, the page available days counter should update to
    // exclude the current vacation's days from the consumed total.
    const availableDuringEdit = await vacationsPage.getAvailableDays();

    // The available days during edit should be >= the days before edit
    // (because the current vacation's days are added back to the balance)
    // It should NOT be 0 (that was the bug behavior).
    expect(
      availableDuringEdit,
      `Available days during edit should not be 0 (Bug #3014-21). ` +
        `Before edit: ${availableBefore}, during edit: ${availableDuringEdit}, ` +
        `vacation days: ${daysInDialog}`,
    ).toBeGreaterThan(0);

    // The available days during edit should be >= available before edit
    // because the current vacation's consumed days are excluded
    expect(
      availableDuringEdit,
      `Available days during edit (${availableDuringEdit}) should be >= ` +
        `available before edit (${availableBefore}) since current vacation days are excluded`,
    ).toBeGreaterThanOrEqual(availableBefore);

    // Step 7: Verify Save button is enabled (not disabled due to false 0-available)
    const saveEnabled = await dialog.isSaveEnabled();
    expect(
      saveEnabled,
      "Save button should be enabled — not disabled due to false insufficient-days calculation",
    ).toBeTruthy();

    await verification.captureStep(testInfo, "available-days-correct-in-edit");

    // Close without saving (we're just verifying the display)
    await dialog.cancel();
  } finally {
    // CLEANUP: Delete the vacation via API
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
