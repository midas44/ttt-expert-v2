import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc011Data } from "../../data/day-off/DayoffTc011Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";

/**
 * TC-DO-011: Edit button visibility — only future dates with duration=0.
 *
 * Verifies that the edit (pencil) icon is present on future public holiday
 * rows with duration=0, and absent on past holiday rows.
 */
test("TC-DO-011: Edit button visibility @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc011Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);

  try {
    await login.run();
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 1: Verify edit button IS present on a future d=0 holiday row
    const futureRow = dayOffPage.dayOffRow(data.futureDateDisplay);
    await expect(futureRow.first()).toBeVisible({ timeout: 15000 });

    const hasFutureEdit = await dayOffPage.hasEditButton(
      data.futureDateDisplay,
    );
    expect(hasFutureEdit).toBeTruthy();
    await verification.captureStep(testInfo, "future-row-has-edit");

    // Step 2: Verify edit button is NOT present on a past holiday row
    const pastRow = dayOffPage.dayOffRow(data.pastDateDisplay);
    await expect(pastRow.first()).toBeVisible({ timeout: 15000 });

    const hasPastEdit = await dayOffPage.hasEditButton(data.pastDateDisplay);
    expect(hasPastEdit).toBeFalsy();
    await verification.captureStep(testInfo, "past-row-no-edit");
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
