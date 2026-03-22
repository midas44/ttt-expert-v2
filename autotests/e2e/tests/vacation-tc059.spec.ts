import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc059Data } from "../data/VacationTc059Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { MyVacationsPage } from "../pages/MainPage";
import { VacationCreateDialog } from "../pages/VacationCreateDialog";

test("TC-VAC-059 - Verify working days exclude holidays @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc059Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.employeeLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const vacationsPage = new MyVacationsPage(page);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Navigate to My vacations
  await page.goto(tttConfig.buildUrl("/vacation/my"));
  await vacationsPage.waitForReady();
  await globalConfig.delay();

  // Open vacation creation dialog
  const dialog = await vacationsPage.openCreateRequest();

  // Fill Mon-Fri dates for the week with a holiday
  await dialog.fillVacationPeriod(data.startDate, data.endDate);
  await globalConfig.delay();

  // Read the "Number of days" — should be less than 5 due to holiday
  const daysText = await dialog.getNumberOfDays();
  const daysNumber = parseInt(daysText, 10);

  expect(
    daysNumber,
    `Mon-Fri with holiday should show ${data.expectedDays} days (not 5)`,
  ).toBe(data.expectedDays);

  // Verify it's not 5 (full week) — the holiday is excluded
  expect(daysNumber, "Working days should exclude public holidays").toBeLessThan(5);

  await verification.verify("Creating vacation request", testInfo);

  // Cancel the dialog — don't actually create
  await dialog.cancel();
  await globalConfig.delay();

  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
