import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc046Data } from "../../data/vacation/VacationTc046Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";
import { VacationCreateDialog } from "@ttt/pages/VacationCreateDialog";

/**
 * TC-VAC-046: Holiday impact on working days count.
 * Verifies that the "Number of days" calculation in the vacation creation dialog
 * excludes public holidays from the employee's office-specific production calendar.
 * A Mon-Fri range containing 1 holiday should show 4 working days, not 5.
 */
test("TC-VAC-046: Holiday impact on working days count @regress @vacation @validation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc046Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const loginFixture = new LoginFixture(
    page,
    tttConfig,
    data.username,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // Step 1: Login and switch to English
  await loginFixture.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 2: Navigate to My Vacations
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Open creation dialog
  const dialog = await vacationsPage.openCreateRequest();
  await globalConfig.delay();

  // Step 4: Select Mon-Fri range that includes the public holiday
  await dialog.fillVacationPeriod(data.startInput, data.endInput);
  await globalConfig.delay();
  // Allow time for day count calculation
  await page.waitForTimeout(1500);
  await verification.captureStep(testInfo, "dates-with-holiday-filled");

  // Step 5: Read "Number of days" and verify it accounts for the holiday
  const daysText = await dialog.getNumberOfDays();
  const daysNumber = parseInt(daysText, 10);

  expect(daysNumber).toBe(data.expectedWorkingDays);
  await verification.captureStep(testInfo, "working-days-verified");

  // Step 6: Also verify it's NOT 5 (the naive calendar day count for Mon-Fri)
  expect(
    daysNumber,
    `Expected ${data.expectedWorkingDays} working days (Mon-Fri minus holiday), got ${daysNumber}`,
  ).toBeLessThan(5);

  // Cleanup: Cancel dialog without saving
  await dialog.cancel();
  await globalConfig.delay();

  await logout.runViaDirectUrl();
  await page.close();
});
