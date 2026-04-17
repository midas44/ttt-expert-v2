import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc003Data } from "../../data/day-off/DayoffTc003Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-DO-003: Create transfer request (reschedule day-off to future date).
 *
 * Finds a public holiday with no active transfer request, opens the reschedule
 * modal, selects a future working day, and verifies the arrow format + NEW status.
 * Cleans up by deleting the created request via API.
 */
test("TC-DO-003: Create transfer request @regress", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc003Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const login = new LoginFixture(page, tttConfig, data.username, globalConfig);
  const verification = new VerificationFixture(page, globalConfig);
  const logout = new LogoutFixture(page, tttConfig, globalConfig);
  const dayOffPage = new DayOffPage(page);
  const rescheduleDialog = new RescheduleDialog(page);

  let createdRequestId: number | null = null;

  try {
    // Step 1-2: Login and navigate to Days off tab
    await login.run();
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 3: Find the target public holiday row and click edit
    await dayOffPage.clickEditButton(data.publicDateDisplay);
    await globalConfig.delay();

    // Step 4: Verify reschedule modal opens
    await rescheduleDialog.waitForOpen();
    await verification.captureStep(testInfo, "reschedule-modal-open");

    // Step 5: Verify OK button is disabled initially
    const okEnabledBefore = await rescheduleDialog.isOkEnabled();
    expect(okEnabledBefore).toBeFalsy();

    // Step 6: Select a valid future working day
    const { day, month, year } = data.targetDateParts;
    await rescheduleDialog.selectDate(day, month, year);
    await globalConfig.delay();

    // Step 7: Verify OK button becomes enabled after date selection
    const okEnabledAfter = await rescheduleDialog.isOkEnabled();
    expect(okEnabledAfter).toBeTruthy();
    await verification.captureStep(testInfo, "date-selected-ok-enabled");

    // Step 8: Click OK to create the transfer request
    await rescheduleDialog.clickOk();
    await rescheduleDialog.waitForClose();
    await globalConfig.delay();

    // Step 9: Verify the row now shows arrow format with NEW status
    // The table updates inline after dialog submission
    const arrowPattern = new RegExp(
      `${data.publicDateDisplay}.*\u2192`,
    );
    const arrowRow = dayOffPage.dayOffRow(arrowPattern);
    await expect(arrowRow.first()).toBeVisible({ timeout: 15000 });

    // Step 10: Verify status is NEW
    const status = await dayOffPage.getRowStatus(arrowPattern);
    expect(status.trim().toLowerCase()).toMatch(/new|новый|новая|на подтверждении/i);
    await verification.captureStep(testInfo, "transfer-created-new-status");

    // Extract the created request ID for cleanup
    const listUrl = tttConfig.buildUrl(
      `/api/vacation/v1/employee-dayOff?login=${data.username}&status=NEW`,
    );
    const listResp = await request.get(listUrl, {
      headers: { API_SECRET_TOKEN: tttConfig.apiToken },
    });
    if (listResp.ok()) {
      const body = await listResp.json();
      const items = body?.content ?? body ?? [];
      if (Array.isArray(items) && items.length > 0) {
        const match = items.find(
          (r: { originalDate?: string; original_date?: string }) =>
            r.originalDate === data.publicDate ||
            r.original_date === data.publicDate,
        );
        if (match) createdRequestId = match.id;
      }
    }
  } finally {
    // CLEANUP: Best-effort delete of the created transfer request
    if (createdRequestId) {
      const deleteUrl = tttConfig.buildUrl(
        `/api/vacation/v1/employee-dayOff/${createdRequestId}`,
      );
      await request
        .delete(deleteUrl, {
          headers: { API_SECRET_TOKEN: tttConfig.apiToken },
        })
        .catch(() => {});
    }

    await logout.runViaDirectUrl();
    await page.close();
  }
});
