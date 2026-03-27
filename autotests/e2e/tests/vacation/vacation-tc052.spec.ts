import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc052Data } from "../../data/vacation/VacationTc052Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-052: Sort by Vacation dates column.
 * Creates 3 vacations at different dates, verifies ascending/descending sort.
 */
test("TC-VAC-052: Sort by Vacation dates column @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc052Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // SETUP: Create 3 vacations at different dates (vac1 earliest, vac3 latest)
  const vac1 = await setup.createVacation(data.vac1StartIso, data.vac1EndIso);
  const vac2 = await setup.createVacation(data.vac2StartIso, data.vac2EndIso);
  const vac3 = await setup.createVacation(data.vac3StartIso, data.vac3EndIso);

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

    // Step 4: Click 'Vacation dates' to sort ascending (earliest first)
    await vacationsPage.clickColumnSort("Vacation dates");
    await globalConfig.delay();

    // Step 5: Verify ascending order — earliest vacation appears before later ones
    const ascTexts = await vacationsPage.getColumnTexts("Vacation dates");
    const ascIdx1 = ascTexts.findIndex((t) => data.vac1Pattern.test(t));
    const ascIdx2 = ascTexts.findIndex((t) => data.vac2Pattern.test(t));
    const ascIdx3 = ascTexts.findIndex((t) => data.vac3Pattern.test(t));
    expect(ascIdx1).toBeGreaterThanOrEqual(0);
    expect(ascIdx2).toBeGreaterThanOrEqual(0);
    expect(ascIdx3).toBeGreaterThanOrEqual(0);
    expect(ascIdx1).toBeLessThan(ascIdx2);
    expect(ascIdx2).toBeLessThan(ascIdx3);
    await verification.captureStep(testInfo, "sorted-ascending");

    // Step 6: Click again to sort descending (latest first)
    await vacationsPage.clickColumnSort("Vacation dates");
    await globalConfig.delay();

    // Step 7: Verify descending order — latest vacation appears first
    const descTexts = await vacationsPage.getColumnTexts("Vacation dates");
    const descIdx1 = descTexts.findIndex((t) => data.vac1Pattern.test(t));
    const descIdx2 = descTexts.findIndex((t) => data.vac2Pattern.test(t));
    const descIdx3 = descTexts.findIndex((t) => data.vac3Pattern.test(t));
    expect(descIdx1).toBeGreaterThanOrEqual(0);
    expect(descIdx2).toBeGreaterThanOrEqual(0);
    expect(descIdx3).toBeGreaterThanOrEqual(0);
    expect(descIdx3).toBeLessThan(descIdx2);
    expect(descIdx2).toBeLessThan(descIdx1);
    await verification.captureStep(testInfo, "sorted-descending");
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
    try {
      await setup.deleteVacation(vac3.id);
    } catch {
      /* best-effort */
    }
  }

  await logout.runViaDirectUrl();
  await page.close();
});
