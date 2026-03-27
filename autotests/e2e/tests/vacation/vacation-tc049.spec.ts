import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc049Data } from "../../data/vacation/VacationTc049Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-049: Filter by All tab.
 * SETUP: Creates one NEW + one REJECTED vacation.
 * Verifies All tab shows both open and closed vacations.
 * Note: CANCELED vacations are NOT shown on any tab — REJECTED is used for closed status.
 */
test("TC-VAC-049: Filter by All tab @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc049Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create one NEW vacation + one REJECTED vacation
  const newVac = await setup.createVacation(
    data.newVacStartIso,
    data.newVacEndIso,
  );
  const rejectedVac = await setup.createAndReject(
    data.rejectedVacStartIso,
    data.rejectedVacEndIso,
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

    // Step 4: Click All tab (default sort is descending — newest first on page 1)
    await vacationsPage.clickAllTab();
    await globalConfig.delay();

    // Step 5: Verify NEW vacation IS visible (open status on All tab)
    const newRow = vacationsPage.vacationRow(data.newPeriodPattern);
    await expect(newRow.first()).toBeVisible();

    // Step 6: Verify REJECTED vacation IS also visible (closed status on All tab)
    const rejectedRow = vacationsPage.vacationRow(data.rejectedPeriodPattern);
    await expect(rejectedRow.first()).toBeVisible();
    await verification.captureStep(testInfo, "all-tab-both-visible");

    // Step 7: Switch to Open tab — NEW should be visible, REJECTED should not
    await vacationsPage.clickOpenTab();
    await globalConfig.delay();
    const newRowOnOpen = vacationsPage.vacationRow(data.newPeriodPattern);
    await expect(newRowOnOpen.first()).toBeVisible();
    const rejectedRowOnOpen = vacationsPage.vacationRow(data.rejectedPeriodPattern);
    await expect(rejectedRowOnOpen).toHaveCount(0);
  } finally {
    // CLEANUP: Delete both vacations
    try {
      await setup.deleteVacation(newVac.id);
    } catch { /* best-effort */ }
    try {
      await setup.deleteVacation(rejectedVac.id);
    } catch { /* best-effort */ }
  }

  await logout.runViaDirectUrl();
  await page.close();
});
