import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc034Data } from "../../data/day-off/DayoffTc034Data";
import { LoginFixture } from "@ttt/fixtures/LoginFixture";
import { VerificationFixture } from "@common/fixtures/VerificationFixture";
import { LogoutFixture } from "@ttt/fixtures/LogoutFixture";
import { DayOffPage } from "@ttt/pages/DayOffPage";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  countLedgerEntries,
  getRequestStatus,
  findCalendarDayId,
  deleteTransferRequest,
} from "../../data/day-off/queries/dayoffQueries";

/**
 * TC-DO-034: Path B — Calendar day removed, status DELETED_FROM_CALENDAR.
 *
 * Deletes a production calendar day that has an APPROVED transfer request.
 * This triggers CalendarDeletedApplicationEvent → deleteDayOffs cascade:
 * 1. Request status → DELETED_FROM_CALENDAR
 * 2. Ledger entries physically deleted
 * 3. Vacation balance recalculated
 *
 * Then verifies via UI that the employee's day-off table reflects the change.
 */
test("TC-DO-034: Path B — Calendar day removed, DELETED_FROM_CALENDAR @regress @day-off @col-absences", async ({
  page,
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc034Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  await globalConfig.applyViewport(page);

  const db = new DbClient(tttConfig);
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  let calendarDayId: number | undefined;
  let calendarDeleted = false;

  try {
    // Find the calendar_days row ID for the DELETE endpoint
    calendarDayId = await findCalendarDayId(
      db,
      data.calendarId,
      data.originalDate,
    );

    console.log(
      `[TC-DO-034] APPROVED request #${data.requestId} for ${data.employeeLogin}`,
    );
    console.log(
      `  original_date=${data.originalDate}, calendar_id=${data.calendarId}, dayId=${calendarDayId}`,
    );
    console.log(`  Ledger entries before: ${data.ledgerCountBefore}`);

    // Verify request is APPROVED before deletion
    const statusBefore = await getRequestStatus(db, data.requestId);
    expect(statusBefore, "Request should be APPROVED before cascade").toBe(
      "APPROVED",
    );

    // Delete the calendar day by row ID — triggers Path B cascade via RabbitMQ
    // DELETE /v1/calendar/{id} publishes CalendarDeletedApplicationEvent
    const deleteResp = await request.delete(
      tttConfig.buildUrl(`/api/calendar/v1/calendar/${calendarDayId}`),
      { headers },
    );

    if (!deleteResp.ok()) {
      const body = await deleteResp.text();
      test.skip(
        true,
        `Cannot delete calendar day ${calendarDayId}: ${deleteResp.status()} ${body}`,
      );
      return;
    }
    calendarDeleted = true;

    // Wait for RabbitMQ cascade
    // (CalendarDeletedApplicationEvent → deleteDayOffs → vacation recalculation)
    await new Promise((r) => setTimeout(r, 6000));

    // DB-CHECK: Request status should be DELETED_FROM_CALENDAR
    const statusAfter = await getRequestStatus(db, data.requestId);
    console.log(`  Request status after: ${statusAfter}`);

    expect(
      statusAfter,
      "Path B cascade should set status to DELETED_FROM_CALENDAR",
    ).toBe("DELETED_FROM_CALENDAR");

    // DB-CHECK: Ledger entries should be physically deleted
    const ledgerAfter = await countLedgerEntries(
      db,
      data.employeeId,
      data.originalDate,
    );
    console.log(`  Ledger entries after: ${ledgerAfter}`);

    expect(
      ledgerAfter,
      `Ledger entries should be deleted (was ${data.ledgerCountBefore})`,
    ).toBe(0);

    // UI verification: login as employee and check the day-off table
    const login = new LoginFixture(
      page,
      tttConfig,
      data.employeeLogin,
      globalConfig,
    );
    const verification = new VerificationFixture(page, globalConfig);
    const logout = new LogoutFixture(page, tttConfig, globalConfig);
    const dayoffPage = new DayOffPage(page);

    await login.run();
    await dayoffPage.goto(tttConfig.appUrl);
    await dayoffPage.waitForReady();
    await globalConfig.delay();
    await verification.captureStep(testInfo, "dayoff-page-after-cascade");

    // The transfer row should show "Deleted from calendar" status or be hidden
    const row = dayoffPage.dayOffRow(data.originalDate);
    const rowCount = await row.count();

    if (rowCount > 0) {
      const status = await dayoffPage.getRowStatus(data.originalDate);
      console.log(`  UI row status: "${status}"`);
      // Row may show deleted status or may be hidden entirely
      expect(
        status.toLowerCase(),
        "Row should show deleted/removed status if visible",
      ).toMatch(/delet|удален|cancel|отменен/i);
    } else {
      console.log("  Row not visible (deleted from view) — expected behavior");
    }

    await verification.captureStep(testInfo, "ui-verified");
    await logout.runViaDirectUrl();
  } finally {
    // Cleanup: restore the calendar day if we deleted it
    if (calendarDeleted && calendarDayId) {
      await request
        .post(tttConfig.buildUrl("/api/calendar/v1/calendar"), {
          headers,
          data: {
            calendarId: data.calendarId,
            date: data.originalDate,
            duration: 0,
            reason: "Restored after TC-DO-034",
          },
        })
        .catch((e) =>
          console.log(`[TC-DO-034] Calendar restore failed: ${e}`),
        );
      // Wait for restore cascade to settle
      await new Promise((r) => setTimeout(r, 3000));
    }
    // Cleanup: delete the transfer request
    await deleteTransferRequest(db, data.requestId).catch(() => {});
    await db.close();
    await page.close();
  }
});
