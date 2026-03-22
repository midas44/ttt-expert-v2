import { test } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc007Data } from "../data/VacationTc007Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { HeaderNavigationFixture } from "../fixtures/HeaderNavigationFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";

test("TC-VAC-007 - Edit APPROVED vacation resets status to NEW @regress", async ({
  page,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc007Data.create(
    globalConfig.testDataMode,
    tttConfig,
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

  // Step 3: Locate the APPROVED vacation in the table
  await vacationsPage.waitForVacationRow(data.originalPeriodPattern);
  const statusBefore = await vacationsPage.columnCell(
    data.originalPeriodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusBefore,
    "Approved",
    testInfo,
    "initial-status-approved",
  );

  // Step 4: Click edit (pencil icon) on the APPROVED row
  const editDialog = await vacationsPage.openEditDialog(
    data.originalPeriodPattern,
  );

  // Step 5: Change end date to one day later
  await editDialog.fillVacationPeriod(data.startDate, data.newEndDate);

  // Step 6: Click Save
  await editDialog.submit();
  await globalConfig.delay();

  // Step 7: Verify status changed from "Approved" to "New"
  await vacationsPage.waitForVacationRow(data.editedPeriodPattern);
  const statusAfter = await vacationsPage.columnCell(
    data.editedPeriodPattern,
    "Status",
  );
  await verification.verifyLocatorText(
    statusAfter,
    data.expectedStatusAfterEdit,
    testInfo,
    "status-reset-to-new",
  );

  // Logout (no cleanup — the vacation now has NEW status, not harmful)
  await logout.runViaDirectUrl();
  await page.close();
});
