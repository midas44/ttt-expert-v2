import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc064Data } from "../data/VacationTc064Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDayCorrectionPage } from "../pages/VacationDayCorrectionPage";

test("TC-VAC-064 - Add positive vacation day correction (accountant) @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc064Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // Step 1: Login as accountant
  const login = new LoginFixture(page, tttConfig, data.accountantLogin, globalConfig);
  const mainFixture = new MainFixture(page, tttConfig, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);

  await login.run();
  await mainFixture.ensureLanguage("EN");

  // Step 2: Navigate to Vacation Day Correction page
  await page.goto(tttConfig.buildUrl("/vacation/days-correction"));
  const correctionPage = new VacationDayCorrectionPage(page);
  await correctionPage.waitForReady();
  await globalConfig.delay();

  // Step 3: Use the first employee visible on the page
  const firstRow = page.locator("table tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 10000 });

  // Read the employee name from first column for later re-identification
  const employeeName = (await firstRow.locator("td").first().textContent())?.trim() ?? "";

  // Step 4: Read current vacation days
  const daysBefore = await correctionPage.getCurrentDays(firstRow);
  const daysBeforeNum = parseFloat(daysBefore);

  await verification.verify("Correction of vacation days", testInfo);

  // Step 5: Edit vacation days — add positive correction
  const newValue = (daysBeforeNum + data.correctionAmount).toString();
  await correctionPage.editVacationDays(firstRow, newValue);
  await globalConfig.delay();

  // Step 6: Confirm the correction with a comment
  await correctionPage.confirmCorrection(
    `Autotest TC-VAC-064: adding ${data.correctionAmount} days`,
  );
  await globalConfig.delay();

  // Step 7: Verify the balance changed — re-read the first row
  // The page should still show the same employee (no filter change)
  const rowAfter = page.locator("table tbody tr").first();
  await expect(rowAfter).toBeVisible({ timeout: 10000 });

  const daysAfter = await correctionPage.getCurrentDays(rowAfter);
  const daysAfterNum = parseFloat(daysAfter);

  expect(
    daysAfterNum,
    `Balance should increase by ${data.correctionAmount}: was ${daysBeforeNum}, now ${daysAfterNum}`,
  ).toBeCloseTo(daysBeforeNum + data.correctionAmount, 1);

  await verification.verify("Correction of vacation days", testInfo);

  // Step 8: Revert the correction to leave data clean
  await correctionPage.editVacationDays(rowAfter, daysBeforeNum.toString());
  await globalConfig.delay();
  await correctionPage.confirmCorrection(
    "Autotest TC-VAC-064: reverting correction",
  );
  await globalConfig.delay();

  // Verify reverted
  const rowReverted = page.locator("table tbody tr").first();
  const daysReverted = await correctionPage.getCurrentDays(rowReverted);
  expect(
    parseFloat(daysReverted),
    "Balance should be reverted to original value",
  ).toBeCloseTo(daysBeforeNum, 1);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
