import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc037Data } from "../../data/vacation/VacationTc037Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "@ttt/fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-037: Overlapping vacation — crossing check.
 * SETUP: Creates vacation Mon-Fri via API (range 1).
 * TEST: Attempts to create overlapping vacation Wed-next Wed via UI (range 2).
 * Expected: exception.validation.vacation.dates.crossing
 */
test("TC-VAC-037: Overlapping vacation — crossing check @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc037Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const verification = new VerificationFixture(page, globalConfig);

  // SETUP: Create vacation Mon-Fri via API (range 1)
  const vacation = await setup.createVacation(
    data.setupStartIso,
    data.setupEndIso,
  );

  try {
    // Step 1: Login as pvaynmaster (same user as vacation owner)
    const login = new LoginFixture(
      page,
      tttConfig,
      data.username,
      globalConfig,
    );
    const logout = new LogoutFixture(page, tttConfig, globalConfig);

    await login.run();
    const mainPage = new MainPage(page);
    if ((await mainPage.getCurrentLanguage()) !== "EN") {
      await mainPage.setLanguage("EN");
      await globalConfig.delay();
    }

    // Step 2: Navigate to My Vacations
    await page.goto(`${tttConfig.appUrl}/vacation/my`, {
      waitUntil: "domcontentloaded",
    });
    const vacationsPage = new MyVacationsPage(page);
    await vacationsPage.waitForReady();

    // Step 3: Open create dialog
    const dialog = await vacationsPage.openCreateRequest();

    // Step 4: Fill overlapping dates (Wed of week 1 to Wed of week 2)
    await dialog.fillVacationPeriod(
      data.overlapStartInput,
      data.overlapEndInput,
    );
    await globalConfig.delay();
    await verification.captureStep(testInfo, "overlap-dates-filled");

    // Step 5: Click Save
    await dialog.submit();
    await globalConfig.delay();

    // Step 6: Verify crossing validation error
    const errorText = await dialog.getErrorText();
    const dialogOpen = await dialog.isOpen();

    // Crossing validation should block creation
    expect(
      errorText.length > 0 || dialogOpen,
      `Expected crossing validation. Error: "${errorText}", dialog open: ${dialogOpen}`,
    ).toBe(true);

    if (errorText.length > 0) {
      expect(
        errorText,
        "Expected crossing/overlap error",
      ).toMatch(/crossing|overlap|conflict|exception|validation|already have/i);
    }

    await verification.captureStep(testInfo, "crossing-error-verified");

    // Close dialog
    await dialog.cancel();

    await logout.runViaDirectUrl();
    await page.close();
  } finally {
    // CLEANUP: Delete the setup vacation
    try {
      await setup.deleteVacation(vacation.id);
    } catch {
      /* best-effort */
    }
  }
});
