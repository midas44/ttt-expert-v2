import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc081Data } from "../../data/vacation/VacationTc081Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-081: Flash of irrelevant validation on first date pick (#3127).
 * Bug: selecting a date in the start-date field for the very first time
 * briefly shows a validation error message (flash). Marked as closed —
 * this regression test verifies the fix holds.
 */
test("TC-VAC-081: No flash of validation on first date pick @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc081Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login
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
  await globalConfig.delay();

  // Step 3: Open create dialog
  const dialog = await vacationsPage.openCreateRequest();
  await globalConfig.delay();

  // Step 4: Verify no red text BEFORE selecting any date
  await verification.captureStep(testInfo, "dialog-opened-no-dates");
  await dialog.assertNoRedText();

  // Step 5: Select start date for the first time
  await dialog.selectStartDate(data.startInput);

  // Step 6: IMMEDIATELY check for flash of RED validation error
  // The bug was that a brief flash of red validation text appeared
  // right after the first date selection. Only RED text counts as
  // validation error — informational paragraphs (payment info, day count) are expected.
  await dialog.assertNoRedText();
  await verification.captureStep(testInfo, "after-start-date-no-red-text");

  // Step 7: Select end date — should also not trigger red flash
  await dialog.selectEndDate(data.endInput);
  await dialog.assertNoRedText();
  await verification.captureStep(testInfo, "after-end-date-no-red-text");

  // Step 8: Verify the dialog is in a clean state with both dates set
  const dayCount = await dialog.getNumberOfDays();
  expect(
    dayCount.length,
    "Day count should be displayed after selecting both dates",
  ).toBeGreaterThan(0);

  // Cleanup: close dialog without saving
  await dialog.cancel();
  await logout.runViaDirectUrl();
  await page.close();
});
