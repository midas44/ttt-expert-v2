import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc005Data } from "../data/DayoffTc005Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffPage } from "../pages/DayOffPage";
import { RescheduleDialog } from "../pages/RescheduleDialog";

/**
 * TC-DO-005: Cancel pending transfer request (NEW status).
 *
 * Finds or creates a NEW transfer request, then cancels it via the red X
 * button. Verifies the row reverts to its original state (no arrow format).
 */
test("TC-DO-005: Cancel pending transfer request @regress", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc005Data.create(
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
    // SETUP: If no existing NEW request, create one via UI
    await login.run();
    await dayOffPage.goto(tttConfig.appUrl);
    await dayOffPage.waitForReady();
    await globalConfig.delay();

    if (data.needsApiSetup) {
      // Create a transfer request via the UI (same flow as TC-DO-003)
      await dayOffPage.clickEditButton(data.originalDateDisplay);
      await globalConfig.delay();
      await rescheduleDialog.waitForOpen();

      const [y, m, d] = data.personalDate.split("-").map(Number);
      await rescheduleDialog.selectDate(d, m - 1, y);
      await globalConfig.delay();
      await rescheduleDialog.clickOk();
      await rescheduleDialog.waitForClose();
      await globalConfig.delay();

      // Fetch the created request ID for cleanup fallback
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
    }

    // Step 1: Find the NEW transfer request row (arrow format)
    const arrowPattern = new RegExp(
      `${data.originalDateDisplay}.*\u2192`,
    );
    const arrowRow = dayOffPage.dayOffRow(arrowPattern);
    await expect(arrowRow.first()).toBeVisible({ timeout: 15000 });
    await verification.captureStep(testInfo, "new-request-visible");

    // Step 2: Verify cancel button is present
    const hasCancel = await dayOffPage.hasCancelButton(arrowPattern);
    expect(hasCancel).toBeTruthy();

    // Step 3: Click the cancel (red X) button — no confirmation dialog
    await dayOffPage.clickCancelButton(arrowPattern);
    await globalConfig.delay();

    // Step 4: Verify arrow row disappeared — original date reverts to base format
    await expect(arrowRow.first()).toBeHidden({ timeout: 15000 });

    // Step 6: Verify original holiday row still exists without arrow
    const baseRow = dayOffPage.dayOffRow(data.originalDateDisplay);
    await expect(baseRow.first()).toBeVisible({ timeout: 10000 });
    await verification.captureStep(testInfo, "request-cancelled-reverted");

    // Request was cancelled, no cleanup needed
    createdRequestId = null;
  } finally {
    // CLEANUP: If we created a request and cancellation failed, delete via API
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
