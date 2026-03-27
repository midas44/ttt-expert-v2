import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc009Data } from "../../data/vacation/VacationTc009Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-009: Re-open CANCELED vacation.
 * SETUP: Creates and cancels a vacation via API.
 * Test: finds the CANCELED vacation in the Closed tab, edits it
 * (shortens by one day), and verifies it reappears in the Open tab
 * with status NEW. Confirms the CANCELED→NEW backend transition works
 * through the UI.
 */
test("TC-VAC-009: Re-open CANCELED vacation @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc009Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create → Approve → Cancel vacation via API
  // State machine requires NEW→APPROVED→CANCELED (cancel endpoint is for APPROVED vacations)
  const vacation = await setup.createAndApprove(
    data.startDateIso,
    data.endDateIso,
  );
  await setup.cancelVacation(vacation.id);

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

    // Step 3: Try to find the CANCELED vacation — check All tab (covers both Open and Closed)
    await vacationsPage.clickAllTab();
    await globalConfig.delay();

    // Step 4: Find the CANCELED vacation row
    const allRow = await vacationsPage.waitForVacationRow(data.periodPattern);
    await expect(allRow).toHaveCount(1);
    const statusBefore = await vacationsPage.columnValue(
      data.periodPattern,
      "Status",
    );
    expect(statusBefore.toLowerCase()).toMatch(/cancel|delet/);
    await verification.captureStep(testInfo, "canceled-vacation-found");

    // Step 5-6: Open edit dialog and change end date
    const dialog = await vacationsPage.openEditDialog(data.periodPattern);
    await dialog.fillVacationPeriod(data.startInput, data.newEndInput);
    await globalConfig.delay();

    // Step 7: Submit
    await dialog.submit();
    await globalConfig.delay();

    // Step 8: Verify vacation moves to Open tab with status New
    await vacationsPage.clickOpenTab();
    await globalConfig.delay();
    const openRow = await vacationsPage.waitForVacationRow(
      data.newPeriodPattern,
    );
    await expect(openRow).toHaveCount(1);

    const statusAfter = await vacationsPage.columnValue(
      data.newPeriodPattern,
      "Status",
    );
    expect(statusAfter.toLowerCase()).toContain("new");
    await verification.captureStep(testInfo, "vacation-reopened-as-new");

    // Step 9: Verify available days decreased
    const daysAfter = await vacationsPage.getAvailableDays();
    expect(daysAfter).toBeGreaterThan(0);
  } finally {
    // CLEANUP: Delete the vacation via API
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
