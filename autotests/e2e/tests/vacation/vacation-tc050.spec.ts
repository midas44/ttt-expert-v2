import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc050Data } from "../../data/vacation/VacationTc050Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-050: Column filter — Vacation type: Regular only.
 * Creates one REGULAR + one ADMINISTRATIVE vacation, then filters by Regular type.
 */
test("TC-VAC-050: Column filter — Vacation type: Regular only @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc050Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create one REGULAR + one ADMINISTRATIVE vacation
  const regularVac = await setup.createVacation(
    data.regularStartIso,
    data.regularEndIso,
    "REGULAR",
  );
  const adminVac = await setup.createVacation(
    data.adminStartIso,
    data.adminEndIso,
    "ADMINISTRATIVE",
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

    // Step 4: Verify both vacations are visible initially
    await expect(
      vacationsPage.vacationRow(data.regularPeriodPattern).first(),
    ).toBeVisible();
    await expect(
      vacationsPage.vacationRow(data.adminPeriodPattern).first(),
    ).toBeVisible();
    await verification.captureStep(testInfo, "both-visible-before-filter");

    // Step 5: Open filter on "Vacation type" column
    await vacationsPage.openColumnFilter("Vacation type");
    await globalConfig.delay();

    // Step 6: Uncheck "All", check "Regular" only
    await vacationsPage.toggleFilterCheckbox("All");
    await vacationsPage.toggleFilterCheckbox("Regular");
    await globalConfig.delay();

    // Step 7: Verify only Regular vacation is shown
    await expect(
      vacationsPage.vacationRow(data.regularPeriodPattern).first(),
    ).toBeVisible();
    await expect(
      vacationsPage.vacationRow(data.adminPeriodPattern),
    ).toHaveCount(0);
    await verification.captureStep(testInfo, "regular-only-filtered");

    // Step 8: Close filter dropdown
    await vacationsPage.closeColumnFilter();
  } finally {
    try {
      await setup.deleteVacation(regularVac.id);
    } catch {
      /* best-effort */
    }
    try {
      await setup.deleteVacation(adminVac.id);
    } catch {
      /* best-effort */
    }
  }

  await logout.runViaDirectUrl();
  await page.close();
});
