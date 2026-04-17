import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc038Data } from "../../data/vacation/VacationTc038Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "@ttt/pages/MainPage";

/**
 * TC-VAC-038: Weekend-only vacation (0 working days) — rejected.
 * Selects Saturday-Sunday dates. Number of days = 0.
 * Expected: Save button disabled + minimum duration validation message.
 */
test("TC-VAC-038: Weekend-only vacation — rejected @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc038Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login, switch to English
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

  // Step 4: Fill Saturday-Sunday dates
  await dialog.fillVacationPeriod(data.startInput, data.endInput);
  await globalConfig.delay();

  // Step 5: Verify "Number of days" shows 0
  const daysText = await dialog.getNumberOfDays();
  expect(daysText, "Expected 0 working days for weekend range").toBe("0");
  await verification.captureStep(testInfo, "weekend-zero-days");

  // Step 6: Verify Save button is disabled (UI prevents 0-day vacations)
  const saveEnabled = await dialog.isSaveEnabled();
  expect(saveEnabled, "Save button should be disabled for 0-day vacation").toBe(
    false,
  );

  // Step 7: Verify validation message about minimum duration
  const validationMsg = await dialog.getValidationMessage();
  expect(
    validationMsg,
    "Expected validation message about minimum vacation duration",
  ).toMatch(/shorter than 1 day|cannot be shorter|minimum/i);

  await verification.captureStep(testInfo, "weekend-duration-error");

  // Close dialog
  await dialog.cancel();

  await logout.runViaDirectUrl();
  await page.close();
});
