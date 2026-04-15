import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc010Data } from "../../data/vacation/VacationTc010Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-010: View Request Details dialog.
 * SETUP: Creates a vacation via API.
 * Test: opens the Request Details dialog and verifies all key fields
 * are present (Period, Number of days, Status, Vacation type).
 * Also verifies the Close button (X) dismisses the dialog.
 */
test("TC-VAC-010: View Request Details dialog @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc010Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create a NEW vacation via API
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

    // Step 3: Open Request Details dialog
    const detailsDialog = await vacationsPage.openRequestDetails(
      data.periodPattern,
    );
    await verification.captureStep(testInfo, "request-details-open");

    // Step 4: Verify key fields are displayed
    const dialogRoot = detailsDialog.root();

    // Period field — contains month abbreviation
    await expect(dialogRoot).toContainText(
      /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/,
    );

    // Number of days — should display the count
    const numberOfDays = await detailsDialog.getFieldValue("Number of days");
    expect(parseInt(numberOfDays, 10)).toBeGreaterThanOrEqual(1);

    // Status — should be "New" (just created via API)
    const statusText = await detailsDialog.getFieldValue("Status");
    expect(statusText.toLowerCase()).toContain("new");

    // Vacation type — should be "Regular" (default)
    const typeText = await detailsDialog.getFieldValue("Vacation type");
    expect(typeText.toLowerCase()).toContain("regular");

    await verification.captureStep(testInfo, "all-fields-verified");

    // Step 5: Close dialog via Close button (X)
    await detailsDialog.close();

    // Step 6: Verify dialog is dismissed — table should be visible again
    await vacationsPage.waitForVacationRow(data.periodPattern);
    await verification.captureStep(testInfo, "dialog-closed-successfully");
  } finally {
    // CLEANUP: Delete the vacation via API
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
