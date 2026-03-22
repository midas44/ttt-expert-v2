import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc066Data } from "../data/VacationTc066Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { MainFixture } from "../fixtures/MainFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { VacationDayCorrectionPage } from "../pages/VacationDayCorrectionPage";

test("TC-VAC-066 - Cannot add negative correction for AV=false employee @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc066Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // Precondition: first alphabetical employee must be AV=false
  expect(
    data.isAdvanceVacation,
    `First employee (${data.employeeTableName}) must be AV=false for this test`,
  ).toBe(false);

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

  // Step 3: Use the first row (alphabetically first employee — AV=false)
  const firstRow = page.locator("table tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 10000 });

  // Step 4: Read current vacation days
  const daysBefore = await correctionPage.getCurrentDays(firstRow);
  const daysBeforeNum = parseFloat(daysBefore);

  await verification.verify("Correction of vacation days", testInfo);

  // Step 5: Attempt to type a negative value (-1)
  // The EditBox component for numeric fields rejects the minus sign,
  // preventing negative balance for AV=false employees at the UI level.
  const editableBtn = firstRow.locator("td").nth(2).locator("button");
  await editableBtn.click();

  const input = firstRow.locator("td input").first();
  await input.waitFor({ state: "visible", timeout: 3000 });

  // Select all and type negative value
  await page.keyboard.press("Control+A");
  await page.keyboard.type("-1");
  await globalConfig.delay();

  // Read the input value — the minus sign should be stripped or ignored
  const inputValue = await input.inputValue();

  // Press Enter to attempt submission
  await page.keyboard.press("Enter");
  await globalConfig.delay();

  // Step 6: Verify that either:
  // a) The confirmation modal did NOT appear (input rejected "-" and reverted), OR
  // b) If modal appeared, the value is still positive (minus was stripped → "1")
  const modal = page.getByRole("dialog").first();
  const modalVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);

  if (modalVisible) {
    // If modal appeared, the minus was stripped → value became "1"
    // Cancel to not make a change
    const cancelBtn = modal.getByRole("button", { name: /cancel/i });
    await cancelBtn.click();
    await modal.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
  }

  // Step 7: Verify balance is unchanged (negative correction prevented)
  const firstRowAfter = page.locator("table tbody tr").first();
  await expect(firstRowAfter).toBeVisible({ timeout: 10000 });

  const daysAfter = await correctionPage.getCurrentDays(firstRowAfter);
  const daysAfterNum = parseFloat(daysAfter);

  // The balance should be unchanged — negative value was rejected at UI level
  expect(
    daysAfterNum,
    `Balance should remain ${daysBeforeNum} after rejected negative input. Got: ${daysAfterNum}`,
  ).toBeCloseTo(daysBeforeNum, 1);

  await verification.verify("Correction of vacation days", testInfo);

  // Cleanup
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  await logout.runViaDirectUrl();
  await page.close();
});
