import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc053Data } from "../../data/vacation/VacationTc053Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-053: Table footer — Total row sums.
 * Creates 2 REGULAR vacations and verifies the footer Total row sums correctly.
 */
test("TC-VAC-053: Table footer — Total row sums @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc053Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create 2 REGULAR vacations
  const vac1 = await setup.createVacation(data.vac1StartIso, data.vac1EndIso);
  const vac2 = await setup.createVacation(data.vac2StartIso, data.vac2EndIso);

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

    // Step 4: Read individual Regular days from body rows
    const regularDaysValues = await vacationsPage.getColumnTexts(
      "Regular days",
    );
    const bodySum = regularDaysValues
      .map((v) => parseInt(v, 10))
      .filter((n) => !isNaN(n))
      .reduce((sum, n) => sum + n, 0);

    // Step 5: Read footer Total row Regular days
    const footerTotal = await vacationsPage.getFooterColumnValue(
      "Regular days",
    );
    const footerValue = parseInt(footerTotal, 10);

    // Step 6: Verify footer matches sum of body rows
    expect(footerValue).toBe(bodySum);
    await verification.captureStep(testInfo, "footer-regular-days-match");

    // Step 7: Check Administrative days footer
    const adminFooter = await vacationsPage.getFooterColumnValue(
      "Administrative days",
    );
    const adminValues = await vacationsPage.getColumnTexts(
      "Administrative days",
    );
    const adminBodySum = adminValues
      .map((v) => parseInt(v, 10))
      .filter((n) => !isNaN(n))
      .reduce((sum, n) => sum + n, 0);
    expect(parseInt(adminFooter, 10)).toBe(adminBodySum);
    await verification.captureStep(testInfo, "footer-admin-days-match");
  } finally {
    try {
      await setup.deleteVacation(vac1.id);
    } catch {
      /* best-effort */
    }
    try {
      await setup.deleteVacation(vac2.id);
    } catch {
      /* best-effort */
    }
  }

  await logout.runViaDirectUrl();
  await page.close();
});
