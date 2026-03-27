import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc048Data } from "../../data/vacation/VacationTc048Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-048: Filter by Closed tab.
 * SETUP: Creates then rejects a vacation.
 * Verifies Closed tab shows the REJECTED vacation.
 * Note: Closed tab shows PAID + REJECTED, NOT CANCELED.
 */
test("TC-VAC-048: Filter by Closed tab @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc048Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create then reject a vacation
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

    // Step 4: Verify REJECTED vacation is NOT on the Open tab (default)
    const rowOnOpen = vacationsPage.vacationRow(data.rejectedPeriodPattern);
    await expect(rowOnOpen).toHaveCount(0);

    // Step 5: Click Closed tab
    await vacationsPage.clickClosedTab();
    await globalConfig.delay();

    // Step 6: Verify REJECTED vacation IS visible on Closed tab
    const closedRow = vacationsPage.vacationRow(data.rejectedPeriodPattern);
    await expect(closedRow.first()).toBeVisible();
    await verification.captureStep(testInfo, "closed-tab-rejected-visible");

    // Step 7: Verify the status column shows "Rejected"
    const status = await vacationsPage.columnValue(
      data.rejectedPeriodPattern,
      "Status",
    );
    expect(status.toLowerCase()).toContain("reject");
    await verification.captureStep(testInfo, "closed-tab-status-rejected");
  } finally {
    // CLEANUP: Delete the rejected vacation
    try {
      await setup.deleteVacation(rejectedVac.id);
    } catch { /* best-effort */ }
  }

  await logout.runViaDirectUrl();
  await page.close();
});
