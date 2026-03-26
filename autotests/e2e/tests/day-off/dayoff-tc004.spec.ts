import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc004Data } from "../../data/day-off/DayoffTc004Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";

/**
 * TC-DO-004: Edit transfer request (change personal date).
 *
 * Finds or creates a NEW transfer request, then edits it via the reschedule
 * modal to change the personal date. Verifies the arrow format updates and
 * status remains NEW. Cleans up by deleting the request via API.
 */
test("TC-DO-004: Edit transfer request @regress", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc004Data.create(
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
    await login.run();
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // SETUP: Create a transfer request via UI if none exists
    if (data.needsApiSetup) {
      await dayOffPage.clickEditButton(data.originalDateDisplay);
      await globalConfig.delay();
      await rescheduleDialog.waitForOpen();

      const { day, month, year } = data.currentPersonalDateParts;
      await rescheduleDialog.selectDate(day, month, year);
      await globalConfig.delay();
      await rescheduleDialog.clickOk();
      await rescheduleDialog.waitForClose();
      await globalConfig.delay();

      // Fetch the created request ID for cleanup
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
              r.originalDate === data.originalDate ||
              r.original_date === data.originalDate,
          );
          if (match) createdRequestId = match.id;
        }
      }

      // Reload page to ensure table shows fresh data after creation
      await dayOffPage.goto(tttConfig.appUrl);
      await dayOffPage.waitForReady();
      await globalConfig.delay();
    }

    // Step 1: Find the NEW transfer request row (arrow format)
    const arrowPattern = new RegExp(
      `${data.originalDateDisplay}.*\u2192`,
    );
    const arrowRow = dayOffPage.dayOffRow(arrowPattern);
    await expect(arrowRow.first()).toBeVisible({ timeout: 15000 });

    // Step 2: Click edit on the arrow row to open reschedule modal
    await dayOffPage.clickEditButton(arrowPattern);
    await globalConfig.delay();

    // Step 3: Verify reschedule modal opens
    await rescheduleDialog.waitForOpen();
    await verification.captureStep(testInfo, "edit-modal-open");

    // Step 4: Select a new target date (different from current personal date)
    const { day: newDay, month: newMonth, year: newYear } =
      data.newTargetDateParts;
    await rescheduleDialog.selectDate(newDay, newMonth, newYear);
    await globalConfig.delay();

    // Step 5: Click OK to save the edit
    await rescheduleDialog.clickOk();
    await rescheduleDialog.waitForClose();
    await globalConfig.delay();

    // Reload page to ensure table shows updated data after edit
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    // Step 6: Verify arrow row still exists for the original date
    const updatedArrowPattern = new RegExp(
      `${data.originalDateDisplay}.*\u2192`,
    );
    const updatedRow = dayOffPage.dayOffRow(updatedArrowPattern);
    await expect(updatedRow.first()).toBeVisible({ timeout: 15000 });

    // Step 6b: Verify the arrow now contains the new target date
    const updatedDateText = await dayOffPage.getRowFirstCellText(updatedArrowPattern);
    expect(updatedDateText).toContain(data.newTargetDateDisplay);

    // Step 7: Verify status remains NEW
    const status = await dayOffPage.getRowStatus(updatedArrowPattern);
    expect(status.trim().toLowerCase()).toMatch(
      /new|новый|новая|на подтверждении/i,
    );
    await verification.captureStep(testInfo, "edit-completed-new-status");
  } finally {
    // CLEANUP: Delete the transfer request
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
