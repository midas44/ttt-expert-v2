import { test, expect } from "@playwright/test";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { DayoffTc010Data } from "../data/DayoffTc010Data";
import { LoginFixture } from "../fixtures/LoginFixture";
import { VerificationFixture } from "../fixtures/VerificationFixture";
import { LogoutFixture } from "../fixtures/LogoutFixture";
import { DayOffPage } from "../pages/DayOffPage";
import { RescheduleDialog } from "../pages/RescheduleDialog";

/**
 * TC-DO-010: APPROVED status displays only lastApprovedDate (no arrow).
 *
 * Verifies that APPROVED transfer requests display only the personal date
 * (the date the holiday was moved to) without the arrow format. If no
 * APPROVED request exists, creates one via UI and approves via API.
 */
test("TC-DO-010: APPROVED status displays lastApprovedDate only @regress", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc010Data.create(
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
    // SETUP: If no APPROVED request exists, create one and approve via API
    if (data.needsApiSetup) {
      await login.run();
      await dayOffPage.goto(tttConfig.appUrl);
      await dayOffPage.waitForReady();
      await globalConfig.delay();

      // Create transfer request via UI
      await dayOffPage.clickEditButton(data.originalDateDisplay);
      await globalConfig.delay();
      await rescheduleDialog.waitForOpen();

      const [y, m, d] = data.personalDate.split("-").map(Number);
      await rescheduleDialog.selectDate(d, m - 1, y);
      await globalConfig.delay();
      await rescheduleDialog.clickOk();
      await rescheduleDialog.waitForClose();
      await globalConfig.delay();

      // Fetch the created request ID
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

      // Approve via API
      if (createdRequestId) {
        const approveUrl = tttConfig.buildUrl(
          `/api/vacation/v1/employee-dayOff/${createdRequestId}/approve`,
        );
        await request.put(approveUrl, {
          headers: { API_SECRET_TOKEN: tttConfig.apiToken },
        });
      }

      // Reload page to see updated status
      await dayOffPage.goto(tttConfig.appUrl);
      await dayOffPage.waitForReady();
      await globalConfig.delay();
    } else {
      await login.run();
      await dayOffPage.goto(tttConfig.appUrl);
      await dayOffPage.waitForReady();
      await globalConfig.delay();
    }

    // Step 1: Find the APPROVED row by personal date (no arrow format)
    const personalRow = dayOffPage.dayOffRow(data.personalDateDisplay);
    await expect(personalRow.first()).toBeVisible({ timeout: 15000 });

    // Step 2: Verify the date column does NOT contain arrow format
    const hasArrow = await dayOffPage.rowHasArrowFormat(
      data.personalDateDisplay,
    );
    expect(hasArrow).toBeFalsy();

    // Step 3: Verify status shows "Approved" (EN or RU)
    const status = await dayOffPage.getRowStatus(data.personalDateDisplay);
    expect(status.trim().toLowerCase()).toMatch(
      /approved|утвержд|подтвержд/i,
    );
    await verification.captureStep(testInfo, "approved-no-arrow");
  } finally {
    // CLEANUP: Delete if we created the request
    if (data.needsApiSetup && createdRequestId) {
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
