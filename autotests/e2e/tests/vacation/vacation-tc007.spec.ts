import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc007Data } from "../../data/vacation/VacationTc007Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { MainPage, MyVacationsPage } from "../../pages/MainPage";

/**
 * TC-VAC-007: Cancel (delete) a NEW vacation.
 * SETUP: Creates a vacation via API, then deletes it via the UI.
 * Verifies it moves to the Closed tab and available days are restored.
 */
test("TC-VAC-007: Cancel NEW vacation @regress @vacation", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc007Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);

  // SETUP: Create NEW vacation via API
  await setup.createVacation(data.startDateIso, data.endDateIso);

  // Step 1-2: Login, switch to English, navigate
  await login.run();
  const mainPage = new MainPage(page);
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }
  await page.goto(`${tttConfig.appUrl}/vacation/my`, {
    waitUntil: "domcontentloaded",
  });
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Note available days before deletion
  const daysBefore = await vacationsPage.getAvailableDays();
  await verification.captureStep(testInfo, "before-delete");

  // Step 4-6: Open request details and delete
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();
  await globalConfig.delay();

  // Step 7: Verify vacation disappeared from Open tab
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await verification.captureStep(testInfo, "vacation-removed-from-open");

  // Step 8-9: Switch to Closed tab and verify vacation appears
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();
  const closedRow = await vacationsPage.waitForVacationRow(
    data.periodPattern,
  );
  await expect(closedRow).toHaveCount(1);

  const closedStatus = await vacationsPage.columnValue(
    data.periodPattern,
    "Status",
  );
  expect(closedStatus.toLowerCase()).toMatch(/delet|cancel/);
  await verification.captureStep(testInfo, "vacation-in-closed-tab");

  // Step 10: Verify available days restored
  await vacationsPage.clickOpenTab();
  await globalConfig.delay();
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(daysAfter).toBeGreaterThanOrEqual(daysBefore);

  // No CLEANUP needed — vacation is already deleted/canceled
  await logout.runViaDirectUrl();
  await page.close();
});
