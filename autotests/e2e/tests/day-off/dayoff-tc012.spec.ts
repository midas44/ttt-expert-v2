import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc012Data } from "../../data/day-off/DayoffTc012Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { RescheduleDialog } from "@ttt/pages/RescheduleDialog";

/**
 * TC-DO-012: Cancel button only on NEW status rows.
 *
 * Verifies that the cancel (red X) button is present on NEW transfer
 * request rows and absent on regular (non-transfer) holiday rows.
 */
test("TC-DO-012: Cancel button only on NEW status rows @regress", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc012Data.create(
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
      await dayOffPage.clickEditButton(data.newOriginalDateDisplay);
      await globalConfig.delay();
      await rescheduleDialog.waitForOpen();

      const { day, month, year } = data.newPersonalDateParts;
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
              r.originalDate === data.newOriginalDate ||
              r.original_date === data.newOriginalDate,
          );
          if (match) createdRequestId = match.id;
        }
      }
    }

    // Step 1: Verify cancel button IS present on NEW transfer request row
    const arrowPattern = new RegExp(
      `${data.newOriginalDateDisplay}.*\u2192`,
    );
    const newRow = dayOffPage.dayOffRow(arrowPattern);
    await expect(newRow.first()).toBeVisible({ timeout: 15000 });

    const hasCancel = await dayOffPage.hasCancelButton(arrowPattern);
    expect(hasCancel).toBeTruthy();
    await verification.captureStep(testInfo, "new-row-has-cancel");

    // Step 2: Verify cancel button is NOT present on a regular holiday row
    const regularRow = dayOffPage.dayOffRow(data.regularDateDisplay);
    await expect(regularRow.first()).toBeVisible({ timeout: 15000 });

    const hasRegularCancel = await dayOffPage.hasCancelButton(
      data.regularDateDisplay,
    );
    expect(hasRegularCancel).toBeFalsy();
    await verification.captureStep(testInfo, "regular-row-no-cancel");
  } finally {
    // CLEANUP: Delete the transfer request if we created it
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
