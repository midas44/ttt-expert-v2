import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc017Data } from "../data/DayoffTc017Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffPage } from "../pages/DayOffPage";
import { RescheduleDialog } from "../pages/RescheduleDialog";

/**
 * TC-DO-017: OK button disabled until date selected in transfer modal.
 *
 * Cancels an existing NEW request via UI to free the holiday, then opens
 * the create modal and verifies: OK starts disabled → select date → OK enabled.
 */
test("TC-DO-017: OK button disabled until date selected @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc017Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);
  const rescheduleDialog = new RescheduleDialog(page);

  try {
    // Step 1: Login and navigate to Days off tab
    await login.run();
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 2: Cancel the existing NEW request to free the holiday
    const arrowPattern = new RegExp(
      `${data.originalDateDisplay}.*\u2192`,
    );
    await dayOffPage.clickCancelButton(arrowPattern);
    await globalConfig.delay();

    // Reload page to see the freed holiday in base format
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Click edit on the now-free holiday row (base format, no arrow)
    await dayOffPage.clickEditButton(data.originalDateDisplay);
    await globalConfig.delay();

    // Step 4: Verify reschedule modal opens
    await rescheduleDialog.waitForOpen();
    await verification.captureStep(testInfo, "modal-open");

    // Step 5: Verify OK button is disabled (no date selected in create mode)
    const okEnabledBefore = await rescheduleDialog.isOkEnabled();
    expect(
      okEnabledBefore,
      "OK button should be disabled before selecting a date",
    ).toBeFalsy();
    await verification.captureStep(testInfo, "ok-disabled");

    // Step 6: Select any available date in the calendar
    const selectedDay = await rescheduleDialog.selectFirstAvailableDate();
    expect(
      selectedDay,
      "Should find at least one available date",
    ).not.toBeNull();
    await globalConfig.delay();

    // Step 7: Verify OK button becomes enabled
    const okEnabledAfter = await rescheduleDialog.isOkEnabled();
    expect(
      okEnabledAfter,
      "OK button should be enabled after selecting a date",
    ).toBeTruthy();
    await verification.captureStep(testInfo, "ok-enabled");

    // Step 8: Close modal without saving (holiday stays free)
    await rescheduleDialog.clickCancel();
    await rescheduleDialog.waitForClose();
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
