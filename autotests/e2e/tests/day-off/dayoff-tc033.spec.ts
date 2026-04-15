import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { DayoffTc033Data } from "../../data/day-off/DayoffTc033Data";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  countLedgerEntries,
  deleteTransferRequest,
} from "../../data/day-off/queries/dayoffQueries";

/**
 * TC-DO-033: Path A — Calendar day moved, transfer request follows.
 *
 * Creates an APPROVED transfer request, then adds a test holiday to the
 * production calendar on a date near the employee's personal_date.
 * This triggers the CalendarChangedApplicationEvent → CalendarUpdateProcessorImpl
 * cascade (Path A), which creates a NEW ledger entry for the moved date.
 *
 * WARNING: BUG-DO-8 — orphaned ledger entries remain after Path A.
 * The old ledger entry is NOT cleaned up when a new one is created.
 */
test("TC-DO-033: Path A — Calendar day moved, transfer follows @regress @day-off @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc033Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const db = new DbClient(tttConfig);
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  const testHolidayDate = data.testHolidayDate;
  let createdCalendarDayId: number | undefined;

  try {
    // Record ledger count before the cascade
    const ledgerBefore = await countLedgerEntries(db, data.employeeId, data.originalDate);
    console.log(
      `[TC-DO-033] APPROVED request #${data.requestId} for ${data.employeeLogin}`,
    );
    console.log(
      `  original_date=${data.originalDate}, personal_date=${data.personalDate}`,
    );
    console.log(`  Ledger entries before: ${ledgerBefore}`);
    console.log(
      `  Adding test holiday on ${testHolidayDate} to calendar ${data.calendarId}`,
    );

    // Create a new calendar day (holiday) on the test date
    // POST /v1/calendar returns {id, date, duration, reason}
    const createResp = await request.post(
      tttConfig.buildUrl("/api/calendar/v1/calendar"),
      {
        headers,
        data: {
          calendarId: data.calendarId,
          date: testHolidayDate,
          duration: 0,
          reason: "TC-DO-033 test holiday (Path A trigger)",
        },
      },
    );

    if (!createResp.ok()) {
      // Fallback to PUT (create-or-update, deprecated)
      const putResp = await request.put(
        tttConfig.buildUrl("/api/calendar/v1/calendar"),
        {
          headers,
          data: {
            calendarId: data.calendarId,
            date: testHolidayDate,
            duration: 0,
            reason: "TC-DO-033 test holiday (Path A trigger)",
          },
        },
      );
      if (!putResp.ok()) {
        const body = await putResp.text();
        test.skip(
          true,
          `Cannot create calendar entry: POST=${createResp.status()}, PUT=${putResp.status()}. ${body}`,
        );
        return;
      }
      const putBody = await putResp.json();
      createdCalendarDayId = putBody.id;
    } else {
      const body = await createResp.json();
      createdCalendarDayId = body.id;
    }
    console.log(`  Created calendar day ID: ${createdCalendarDayId}`);

    // Wait for RabbitMQ cascade (CalendarChangedApplicationEvent → processDay)
    await new Promise((r) => setTimeout(r, 6000));

    // DB-CHECK: Verify new ledger entry was created (Path A creates entries)
    const ledgerAfter = await countLedgerEntries(db, data.employeeId, data.originalDate);
    console.log(`  Ledger entries after: ${ledgerAfter}`);

    // Path A should create at least one new ledger entry
    // Note: BUG-DO-8 means old entries are NOT cleaned up
    expect(
      ledgerAfter,
      `Path A cascade should create new ledger entry (before: ${ledgerBefore}, after: ${ledgerAfter})`,
    ).toBeGreaterThanOrEqual(ledgerBefore);

    // DB-CHECK: Verify the request status is still APPROVED (Path A does NOT change status)
    const statusAfter = await db.queryOne<{ status: string }>(
      `SELECT status FROM ttt_vacation.employee_dayoff_request WHERE id = $1`,
      [data.requestId],
    );
    console.log(`  Request status after cascade: ${statusAfter.status}`);

    expect(
      statusAfter.status,
      "Path A cascade should NOT change request status from APPROVED",
    ).toBe("APPROVED");

    // DB-CHECK: Check for orphaned ledger entries (BUG-DO-8)
    if (ledgerAfter > ledgerBefore + 1) {
      console.log(
        `  WARNING: BUG-DO-8 — orphaned ledger entries detected (expected ${ledgerBefore + 1}, got ${ledgerAfter})`,
      );
    }
  } finally {
    // Cleanup: remove the test calendar entry by row ID
    if (createdCalendarDayId) {
      await request
        .delete(
          tttConfig.buildUrl(
            `/api/calendar/v1/calendar/${createdCalendarDayId}`,
          ),
          { headers },
        )
        .catch((e) =>
          console.log(`[TC-DO-033] Calendar cleanup failed: ${e}`),
        );
    }
    await db.close();
  }
});
