import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc022Data } from "../data/VacationTc022Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-022 - Cancel APPROVED vacation @regress", async ({
  page,
  request,
}, testInfo) => {
  // 1. Config and data (request passed for API setup if no APPROVED vacation exists in DB)
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc022Data.create(
    globalConfig.testDataMode,
    tttConfig,
    request,
  );

  // 2. Apply viewport
  await globalConfig.applyViewport(page);

  // 3. Fixtures
  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const navigation = new HeaderNavigationFixture(page, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);

  // Step 1: Login as vacation owner
  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to My vacations
  await navigation.navigate(
    "Calendar of absences > My vacations and days off",
  );
  await vacationsPage.waitForReady();

  // Step 3: Locate the APPROVED vacation
  await vacationsPage.waitForVacationRow(data.periodPattern);
  const statusBefore = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusBefore,
    "Approved",
    testInfo,
    "initial-status-approved",
  );

  // Note available days before cancellation
  const daysBefore = await vacationsPage.getAvailableDays();

  // Step 4-5: Cancel the APPROVED vacation via Request Details → Delete
  const detailsDialog = await vacationsPage.openRequestDetails(
    data.periodPattern,
  );
  await detailsDialog.deleteRequest();

  // Step 6: Verify vacation disappears from Open tab
  await vacationsPage.waitForVacationRowToDisappear(data.periodPattern);
  await globalConfig.delay();

  // Step 7: Verify available vacation days increased
  const daysAfter = await vacationsPage.getAvailableDays();
  expect(daysAfter).toBeGreaterThan(daysBefore);

  // Step 8: Verify the row moves to "Closed" tab
  await vacationsPage.clickClosedTab();
  await globalConfig.delay();
  await vacationsPage.waitForVacationRow(data.periodPattern);

  const statusAfter = await vacationsPage.columnCell(
    data.periodPattern,
    "Status",
  );
  const statusText = await statusAfter.textContent();
  expect(
    statusText?.includes("Deleted") || statusText?.includes("Canceled"),
    `Expected status to be Deleted or Canceled, got: ${statusText}`,
  ).toBeTruthy();

  await verification.verifyLocatorVisible(
    vacationsPage.vacationRow(data.periodPattern).first(),
    testInfo,
    "vacation-in-closed-tab",
  );

  // Logout
  await logout.runViaDirectUrl();
  await page.close();
});
