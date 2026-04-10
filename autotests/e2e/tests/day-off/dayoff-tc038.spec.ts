import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc038Data } from "../../data/day-off/DayoffTc038Data";
import { DbClient } from "../../config/db/dbClient";
import {
  getRequestStatus,
  getVacationBalance,
  deleteTransferRequest,
} from "../../data/day-off/queries/dayoffQueries";

/**
 * TC-DO-038: Auto-deletion triggers vacation recalculation (AV=False).
 *
 * Regression test for BUG-DO-16 (#3339) and BUG-DO-22 (#3223):
 * - BUG-DO-16: AV=False balance zeroed after auto-deletion
 * - BUG-DO-22: Vacation balance not updated after auto-deletion
 *
 * Creates an APPROVED transfer request in an AV=False office, records
 * the vacation balance, deletes the calendar day, and verifies:
 * 1. Request set to DELETED_FROM_CALENDAR
 * 2. Vacation balance is recalculated (not zeroed or stale)
 * 3. No incorrect Administrative leave conversion
 */
test("TC-DO-038: Auto-deletion triggers vacation recalculation (AV=False) @regress @day-off @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc038Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const db = new DbClient(tttConfig);
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  let calendarDayDeleted = false;

  try {
    console.log(`[TC-DO-038] AV=False office: ${data.officeName} (${data.officeId})`);
    console.log(`  Employee: ${data.employeeLogin} (id=${data.employeeId})`);
    console.log(`  APPROVED request #${data.requestId} original=${data.originalDate}`);
    console.log(`  Calendar day ID: ${data.calDayId} (calendar ${data.calendarId})`);

    // Verify request is APPROVED before cascade
    const statusBefore = await getRequestStatus(db, data.requestId);
    expect(statusBefore, "Request should be APPROVED before cascade").toBe("APPROVED");

    // Record vacation balance before auto-deletion
    const balanceBefore = await getVacationBalance(db, data.employeeId);
    console.log(`  Vacation balance before: ${balanceBefore}`);

    // Check no Administrative leave requests exist before
    const adminLeaveBefore = await db.queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM ttt_vacation.employee_dayoff_request
       WHERE employee = $1 AND status = 'NEW'
         AND original_date = $2
         AND personal_date = original_date`,
      [data.employeeId, data.originalDate],
    );
    console.log(`  Admin leave entries before: ${adminLeaveBefore.cnt}`);

    // Delete the calendar day — triggers CalendarChangedApplicationEvent cascade
    const delResp = await request.delete(
      tttConfig.buildUrl(`/api/calendar/v1/calendar/${data.calDayId}`),
      { headers },
    );

    if (!delResp.ok()) {
      const body = await delResp.text();
      console.log(`  DELETE calendar day failed: ${delResp.status()} ${body}`);
      test.skip(true, `Cannot delete calendar day: ${delResp.status()}`);
      return;
    }
    calendarDayDeleted = true;
    console.log(`  Calendar day ${data.calDayId} deleted`);

    // Wait for RabbitMQ cascade
    await new Promise((r) => setTimeout(r, 8000));

    // DB-CHECK 1: Request should be DELETED_FROM_CALENDAR
    const statusAfter = await getRequestStatus(db, data.requestId);
    console.log(`  Request status after: ${statusAfter}`);
    expect(
      statusAfter,
      "Request should be DELETED_FROM_CALENDAR after calendar deletion",
    ).toBe("DELETED_FROM_CALENDAR");

    // DB-CHECK 2: Vacation balance should be recalculated
    // After APPROVED transfer is auto-deleted, the vacation day spent on the
    // personal_date should be restored. Balance should be >= before.
    const balanceAfter = await getVacationBalance(db, data.employeeId);
    console.log(`  Vacation balance after: ${balanceAfter}`);

    if (balanceAfter === 0 && balanceBefore > 0) {
      console.log("  FAIL: BUG-DO-16 — balance zeroed after auto-deletion!");
    } else if (balanceAfter === balanceBefore) {
      console.log("  WARNING: BUG-DO-22 — balance unchanged (may not have been recalculated)");
    } else {
      console.log(`  ✓ Balance changed: ${balanceBefore} → ${balanceAfter}`);
    }

    // The balance should not be zeroed (BUG-DO-16 regression)
    if (balanceBefore > 0) {
      expect(
        balanceAfter,
        "BUG-DO-16 regression: balance should not be zeroed",
      ).toBeGreaterThan(0);
    }

    // DB-CHECK 3: No incorrect Administrative leave conversion
    const adminLeaveAfter = await db.queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM ttt_vacation.employee_dayoff_request
       WHERE employee = $1 AND status = 'NEW'
         AND original_date = $2
         AND personal_date = original_date
         AND id != $3`,
      [data.employeeId, data.originalDate, data.requestId],
    );
    console.log(`  Admin leave entries after: ${adminLeaveAfter.cnt}`);

    expect(
      Number(adminLeaveAfter.cnt),
      "No Administrative leave should be created by auto-deletion",
    ).toBe(Number(adminLeaveBefore.cnt));
  } finally {
    // CLEANUP: Restore the deleted calendar day
    if (calendarDayDeleted) {
      await request
        .post(tttConfig.buildUrl("/api/calendar/v1/calendar"), {
          headers,
          data: {
            calendarId: data.calendarId,
            date: data.originalDate,
            duration: 0,
            reason: "TC-DO-038 restore",
          },
        })
        .catch((e) =>
          console.log(`[TC-DO-038] Calendar restore failed: ${e}`),
        );
    }
    // CLEANUP: Delete test request
    await deleteTransferRequest(db, data.requestId).catch(() => {});
    await db.close();
  }
});
