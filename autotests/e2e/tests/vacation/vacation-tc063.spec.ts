import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc063Data } from "../../data/vacation/VacationTc063Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { MainPage } from "../../pages/MainPage";
import { VacationDayCorrectionPage } from "../../pages/VacationDayCorrectionPage";

/**
 * TC-VAC-063: Day correction — AV=false prohibits negative.
 * Logs in as admin, navigates to Employees Vacation Days page,
 * finds an AV=false employee (alphabetically early, on page 1),
 * attempts to set a negative value, and verifies the system blocks it.
 * Ref: vacation-business-rules-reference.md §8, GitLab #3283.
 */
test("TC-VAC-063: Day correction — AV=false prohibits negative @regress @vacation", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc063Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(
    page,
    tttConfig,
    data.adminUsername,
    globalConfig,
  );
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const mainPage = new MainPage(page);
  const correctionPage = new VacationDayCorrectionPage(page);

  // Step 1: Login as accountant/admin
  await login.run();
  if ((await mainPage.getCurrentLanguage()) !== "EN") {
    await mainPage.setLanguage("EN");
    await globalConfig.delay();
  }

  // Step 2: Navigate to Employees Vacation Days page
  await page.goto(`${tttConfig.appUrl}/vacation/days-correction`, {
    waitUntil: "domcontentloaded",
  });
  await correctionPage.waitForReady();
  await globalConfig.delay();
  await verification.captureStep(testInfo, "days-correction-page-loaded");

  // Step 3: Find the AV=false employee directly on page 1 (data class picks alphabetically earliest)
  // The table is sorted by Employee (LastName FirstName) ascending by default
  const row = correctionPage.employeeRow(data.targetEmployeeDisplayName);
  await expect(row).toHaveCount(1, { timeout: 10000 });
  await verification.captureStep(testInfo, "employee-row-found");

  // Step 4: Read current days value
  const currentDays = await correctionPage.getCurrentDays(row);

  // Step 5: Attempt to set vacation days to a negative value
  await correctionPage.editVacationDays(row, "-5");
  await globalConfig.delay();

  // Step 6: Check if the confirmation modal appears or if input is rejected
  const modal = page.getByRole("dialog");
  const modalVisible = await modal.isVisible().catch(() => false);

  if (modalVisible) {
    // Modal appeared — confirm and verify value didn't go negative for AV=false
    await correctionPage.confirmCorrection("Autotest: testing negative block");
    await globalConfig.delay();
    await verification.captureStep(testInfo, "after-negative-confirmation");

    // Re-read the value — it should not have become negative for AV=false
    const row2 = correctionPage.employeeRow(data.targetEmployeeDisplayName);
    const daysAfter = await correctionPage.getCurrentDays(row2);
    const daysAfterNum = parseFloat(daysAfter);
    expect(daysAfterNum).toBeGreaterThanOrEqual(0);
  } else {
    // No modal — input was rejected at the field level
    await verification.captureStep(testInfo, "negative-input-blocked");
    const row2 = correctionPage.employeeRow(data.targetEmployeeDisplayName);
    const daysAfter = await correctionPage.getCurrentDays(row2);
    expect(daysAfter).toBe(currentDays);
  }

  await logout.runViaDirectUrl();
  await page.close();
});
