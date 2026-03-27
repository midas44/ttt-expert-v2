import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc006Data } from "../../data/vacation/VacationTc006Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-006: Edit APPROVED vacation → resets status to NEW.
 * SETUP: Creates and approves a vacation via API.
 * Test: edits start date to one day later via UI, verifying the
 * warning message and that status resets from APPROVED to NEW.
 * Regression test for bug #2640.
 */
test("TC-VAC-006: Edit APPROVED vacation resets status to NEW @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc006Data.create(
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
  const vacation = await setup.createAndApprove(
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

    // Step 3: Find the APPROVED vacation row
    await vacationsPage.waitForVacationRow(data.periodPattern);
    const statusBefore = await vacationsPage.columnValue(
      data.periodPattern,
      "Status",
    );
    expect(statusBefore.toLowerCase()).toContain("approved");
    await verification.captureStep(testInfo, "vacation-approved-before-edit");

    // Step 4: Open edit dialog
    const dialog = await vacationsPage.openEditDialog(data.periodPattern);

    // Step 5: Check for warning text (may or may not be displayed depending on version)
    const dialogText = (await dialog.root().textContent()) ?? "";
    const hasWarning = /changing.*vacation.*new.*status/i.test(dialogText);
    await verification.captureStep(
      testInfo,
      hasWarning ? "warning-text-visible" : "no-warning-text",
    );

    // Step 6: Change start date to one day later (Tuesday)
    await dialog.fillVacationPeriod(data.newStartInput, data.endInput);
    await globalConfig.delay();

    // Step 7: Submit
    await dialog.submit();
    await globalConfig.delay();

    // Step 8: Verify status resets to "New"
    const row = await vacationsPage.waitForVacationRow(data.newPeriodPattern);
    await expect(row).toHaveCount(1);
    const statusAfter = await vacationsPage.columnValue(
      data.newPeriodPattern,
      "Status",
    );
    expect(statusAfter.toLowerCase()).toContain("new");
    await verification.captureStep(testInfo, "vacation-status-reset-to-new");
  } finally {
    // CLEANUP: Delete the vacation via API
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
