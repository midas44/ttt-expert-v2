import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc009Data } from "../../data/day-off/DayoffTc009Data";
import { LoginFixture } from "../../fixtures/LoginFixture";
import { VerificationFixture } from "../../fixtures/VerificationFixture";
import { LogoutFixture } from "../../fixtures/LogoutFixture";
import { DayOffPage } from "../../pages/DayOffPage";
import { RescheduleDialog } from "../../pages/RescheduleDialog";

/**
 * TC-DO-009: NEW status displays arrow format (originalDate → personalDate).
 *
 * Verifies that a NEW transfer request row shows the arrow format
 * "DD.MM.YYYY (weekday) → DD.MM.YYYY (weekday)" with both dates visible.
 */
test("TC-DO-009: NEW status displays arrow format @regress", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc009Data.create(
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

      const { day, month, year } = data.personalDateParts;
      await rescheduleDialog.selectDate(day, month, year);
      await globalConfig.delay();
      await rescheduleDialog.clickOk();
      await rescheduleDialog.waitForClose();
      await globalConfig.delay();

      // Fetch request ID for cleanup
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

    // Step 1: Find the arrow row using one-sided pattern (more robust)
    const arrowPattern = new RegExp(
      `${data.originalDateDisplay}.*\u2192`,
    );
    const arrowRow = dayOffPage.dayOffRow(arrowPattern);
    await expect(arrowRow.first()).toBeVisible({ timeout: 15000 });

    // Step 2: Verify the date cell contains proper arrow format
    // Expected: "DD.MM.YYYY (weekday) → DD.MM.YYYY (weekday)"
    const dateText = await dayOffPage.getRowFirstCellText(arrowPattern);
    expect(dateText).toContain(data.originalDateDisplay);
    expect(dateText).toContain("\u2192");
    expect(dateText).toContain(data.personalDateDisplay);

    // Step 3: Verify the structural format with weekday abbreviations
    expect(dateText).toMatch(
      /\d{2}\.\d{2}\.\d{4}\s*\(\S+\)\s*\u2192\s*\d{2}\.\d{2}\.\d{4}\s*\(\S+\)/,
    );

    // Step 4: Verify status is NEW
    const status = await dayOffPage.getRowStatus(arrowPattern);
    expect(status.trim().toLowerCase()).toMatch(
      /new|новый|новая|на подтверждении/i,
    );
    await verification.captureStep(testInfo, "arrow-format-verified");
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
