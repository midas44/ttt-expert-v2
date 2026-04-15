import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc051Data } from "../../data/vacation/VacationTc051Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-051: Column filter — Status: Approved only.
 * Creates one NEW + one APPROVED vacation, then filters by Approved status.
 */
test("TC-VAC-051: Column filter — Status: Approved only @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc051Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create one NEW + one APPROVED vacation
  const newVac = await setup.createVacation(
    data.newVacStartIso,
    data.newVacEndIso,
  );
  const approvedVac = await setup.createAndApprove(
    data.approvedVacStartIso,
    data.approvedVacEndIso,
  );

  try {
    // Step 1-2: Login, switch to English
    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 3: Navigate to My Vacations, switch to All tab
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    const vacationsPage = new MyVacationsPage(page);
    await vacationsPage.waitForReady();
    await vacationsPage.clickAllTab();
    await globalConfig.delay();

    // Step 4: Verify both vacations visible on All tab
    await expect(
      vacationsPage.vacationRow(data.newPeriodPattern).first(),
    ).toBeVisible();
    await expect(
      vacationsPage.vacationRow(data.approvedPeriodPattern).first(),
    ).toBeVisible();
    await verification.captureStep(testInfo, "both-visible-all-tab");

    // Step 5: Open filter on "Status" column
    await vacationsPage.openColumnFilter("Status");
    await globalConfig.delay();

    // Step 6: Uncheck "All", check "Approved" only
    await vacationsPage.toggleFilterCheckbox("All");
    await vacationsPage.toggleFilterCheckbox("Approved");
    await globalConfig.delay();

    // Step 7: Verify only APPROVED vacation is shown
    await expect(
      vacationsPage.vacationRow(data.approvedPeriodPattern).first(),
    ).toBeVisible();
    await expect(
      vacationsPage.vacationRow(data.newPeriodPattern),
    ).toHaveCount(0);
    await verification.captureStep(testInfo, "approved-only-filtered");

    // Step 8: Close filter dropdown
    await vacationsPage.closeColumnFilter();
  } finally {
    try {
      await setup.deleteVacation(newVac.id);
    } catch {
      /* best-effort */
    }
    try {
      await setup.deleteVacation(approvedVac.id);
    } catch {
      /* best-effort */
    }
  }

  await logout.runViaDirectUrl();
  await page.close();
});
