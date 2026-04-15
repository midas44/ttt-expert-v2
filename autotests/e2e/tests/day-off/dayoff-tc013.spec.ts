import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc013Data } from "../../data/day-off/DayoffTc013Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-DO-013: Transfer modal date constraints — min boundary.
 *
 * Opens the reschedule modal on an existing NEW transfer request and verifies
 * that dates before the original holiday date are disabled in the calendar.
 */
test("TC-DO-013: Transfer modal date constraints — min boundary @regress", async ({
  page,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc013Data.create(
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
    // Step 1-2: Login and navigate to Days off tab
    await login.run();
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Find the NEW request row (arrow format) and click edit
    // NEW request rows show "originalDate → personalDate"
    const arrowPattern = new RegExp(
      `${data.originalDateDisplay}.*\u2192`,
    );
    await dayOffPage.clickEditButton(arrowPattern);
    await globalConfig.delay();

    // Step 4: Verify reschedule modal opens
    await rescheduleDialog.waitForOpen();

    // Step 5: Navigate to the month of the original date
    const { day: origDay, month: origMonth, year: origYear } =
      data.originalDateParts;
    await rescheduleDialog.navigateToTargetMonth(origMonth, origYear);
    await verification.captureStep(testInfo, "modal-at-original-month");

    // Step 6: Verify dates BEFORE the original date are disabled
    if (origDay > 1) {
      const dayBefore = origDay - 1;
      const isDisabled = await rescheduleDialog.isDayDisabled(dayBefore);
      expect(
        isDisabled,
        `Day ${dayBefore} (before original ${origDay}) should be disabled`,
      ).toBeTruthy();
    }

    // Step 7: Check a previous month — should have all days disabled
    if (origMonth > 0) {
      await rescheduleDialog.navigateToTargetMonth(origMonth - 1, origYear);
    } else {
      await rescheduleDialog.navigateToTargetMonth(11, origYear - 1);
    }
    await globalConfig.delay();
    const isPrevMonthDayDisabled = await rescheduleDialog.isDayDisabled(15);
    expect(
      isPrevMonthDayDisabled,
      "Day 15 of previous month should be disabled",
    ).toBeTruthy();
    await verification.captureStep(testInfo, "prev-month-disabled");

    // Step 8: Close modal without saving
    await rescheduleDialog.clickCancel();
    await rescheduleDialog.waitForClose();
  } finally {
    await logout.runViaDirectUrl();
    await page.close();
  }
});
