import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc047Data } from "../../data/vacation/VacationTc047Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-047: Filter by Open tab (default view).
 * SETUP: Creates one NEW + one CANCELED vacation.
 * Verifies Open tab (default) shows NEW but not CANCELED.
 */
test("TC-VAC-047: Filter by Open tab (default view) @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc047Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create one NEW vacation + one CANCELED vacation
  const newVac = await setup.createVacation(
    data.newVacStartIso,
    data.newVacEndIso,
  );
  const canceledVac = await setup.createAndCancel(
    data.canceledVacStartIso,
    data.canceledVacEndIso,
  );

  try {
    // Step 1-2: Login, switch to English
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 3: Navigate to My Vacations
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    const vacationsPage = new MyVacationsPage(page);
    await vacationsPage.waitForReady();
    await globalConfig.delay();

    // Step 4: Verify Open tab is the default — NEW vacation IS visible
    const newRow = vacationsPage.vacationRow(data.newPeriodPattern);
    await expect(newRow.first()).toBeVisible();
    await verification.captureStep(testInfo, "open-tab-new-visible");

    // Step 5: Verify CANCELED vacation is NOT visible on Open tab
    const canceledRow = vacationsPage.vacationRow(data.canceledPeriodPattern);
    await expect(canceledRow).toHaveCount(0);
    await verification.captureStep(testInfo, "open-tab-canceled-hidden");
  } finally {
    // CLEANUP: Delete both vacations
    try {
      await setup.deleteVacation(newVac.id);
    } catch { /* best-effort */ }
    try {
      await setup.deleteVacation(canceledVac.id);
    } catch { /* best-effort */ }
  }

  await logout.runViaDirectUrl();
  await page.close();
});
