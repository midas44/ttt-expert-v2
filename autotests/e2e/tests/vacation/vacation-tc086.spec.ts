import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc086Data } from "../../data/vacation/VacationTc086Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-086: Owner cannot edit PAID vacation.
 * SETUP: Creates, approves, and pays a vacation via API.
 * Test: Verifies no edit icon on PAID vacation in Closed tab.
 * Also verifies API update attempt returns 400.
 * NON_EDITABLE_STATUSES = {CANCELED, PAID}.
 */
test("TC-VAC-086: Owner cannot edit PAID vacation @regress @vacation @permissions", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc086Data.create(globalConfig.testDataMode, tttConfig);
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create, approve, and pay vacation via API
  const vacation = await setup.createApproveAndPay(
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
    await page.goto(`${tttConfig.appUrl}/vacation/my`, { waitUntil: "domcontentloaded" });
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Switch to Closed tab to find PAID vacation
    await vacationsPage.clickClosedTab();
    await globalConfig.delay();

    // Step 4: Find the PAID vacation row and verify NO edit button
    await vacationsPage.waitForVacationRow(data.periodPattern);
    const statusText = await vacationsPage.columnValue(data.periodPattern, "Status");
    expect(statusText.toLowerCase()).toContain("paid");

    const buttonCount = await vacationsPage.getActionButtonCount(data.periodPattern);
    // PAID vacations should have only 1 button (details) — no edit, no cancel
    expect(buttonCount).toBeLessThanOrEqual(1);
    await verification.captureStep(testInfo, "paid-vacation-no-edit-button");

    // Step 5: API verification — attempt to update PAID vacation should fail
    const updateResult = await setup.rawPut(
      `/api/vacation/v1/vacations/${vacation.id}`,
      {
        login: data.username,
        startDate: data.startDateIso,
        endDate: data.endDateIso,
        paymentType: "REGULAR",
      },
    );
    expect(updateResult.status).toBe(400);
    await verification.captureStep(testInfo, "api-update-rejected-400");
  } finally {
    // CLEANUP: Hard-delete via test endpoint
    await setup.deleteVacation(vacation.id);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
