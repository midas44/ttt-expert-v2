import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc035Data } from "../../data/vacation/VacationTc035Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-035: Start date > end date — rejected.
 * Sets end date first (Monday), then sets start date to a later day (Friday).
 * The UI auto-corrects the end date upward, preventing start > end.
 */
test("TC-VAC-035: Start date > end date — rejected @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc035Data.create(
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

  // Step 4: Set end date first (Monday = earlier date),
  // then set start date (Friday = later date).
  // The calendar auto-corrects end to >= start, preventing start > end.
  await dialog.selectEndDate(data.endInput);
  await globalConfig.delay();
  await dialog.selectStartDate(data.startInput);
  await globalConfig.delay();
  await verification.captureStep(testInfo, "reversed-dates-attempted");

  // Step 5: Read back actual input values to verify auto-correction
  const dateInputs = page.locator("input.date-picker__input");
  const actualStart = await dateInputs.nth(0).inputValue();
  const actualEnd = await dateInputs.nth(1).inputValue();

  // Parse dates for comparison (dd.mm.yyyy format)
  const parseDate = (s: string) => {
    const [d, m, y] = s.split(".").map(Number);
    return new Date(y, m - 1, d);
  };

  const startDate = parseDate(actualStart);
  const endDate = parseDate(actualEnd);

  // Verify: the UI must prevent start > end.
  // Either dates were auto-corrected (end >= start),
  // or Save is disabled, or a validation error is shown.
  const saveEnabled = await dialog.isSaveEnabled();
  const validationMsg = await dialog.getValidationMessage();

  const datesAreValid = endDate >= startDate;
  const isProtected = datesAreValid || !saveEnabled || validationMsg.length > 0;

  expect(
    isProtected,
    `Expected date-order protection. Start: ${actualStart}, End: ${actualEnd}, ` +
      `Save enabled: ${saveEnabled}, validation: "${validationMsg}"`,
  ).toBe(true);

  await verification.captureStep(testInfo, "date-order-protection-verified");

  // Close dialog
  await dialog.cancel();

  await logout.runViaDirectUrl();
  await page.close();
});
