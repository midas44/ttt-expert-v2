import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc065Data } from "../data/VacationTc065Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDayCorrectionPage } from "../pages/VacationDayCorrectionPage";

test("TC-VAC-065 - Add negative vacation day correction (AV=true) @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc065Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  await globalConfig.applyViewport(page);

  // Step 1: Login as chief accountant
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

  // Step 3: Use the first employee visible on the page (chief accountant sees all)
  const firstRow = page.locator("table tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 10000 });

  const employeeName = (await firstRow.locator("td").first().textContent())?.trim() ?? "";

  // Step 4: Read current vacation days
  const daysBefore = await correctionPage.getCurrentDays(firstRow);
  const daysBeforeNum = parseFloat(daysBefore);

  await verification.verify("Correction of vacation days", testInfo);

  // Step 5: Apply negative correction — subtract days
  const newValue = (daysBeforeNum + data.correctionAmount).toString();
  await correctionPage.editVacationDays(firstRow, newValue);
  await globalConfig.delay();

  // Step 6: Confirm the correction with a comment
  await correctionPage.confirmCorrection(
    `Autotest TC-VAC-065: negative correction ${data.correctionAmount} days`,
  );
  await globalConfig.delay();

  // Step 7: Verify the balance decreased
  const rowAfter = page.locator("table tbody tr").first();
  await expect(rowAfter).toBeVisible({ timeout: 10000 });

  const daysAfter = await correctionPage.getCurrentDays(rowAfter);
  const daysAfterNum = parseFloat(daysAfter);

  expect(
    daysAfterNum,
    `Balance should decrease by ${Math.abs(data.correctionAmount)}: was ${daysBeforeNum}, now ${daysAfterNum}`,
  ).toBeCloseTo(daysBeforeNum + data.correctionAmount, 1);

  await verification.verify("Correction of vacation days", testInfo);

  // Step 8: Revert — restore original balance
  await correctionPage.editVacationDays(rowAfter, daysBeforeNum.toString());
  await globalConfig.delay();
  await correctionPage.confirmCorrection(
    "Autotest TC-VAC-065: reverting negative correction",
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
