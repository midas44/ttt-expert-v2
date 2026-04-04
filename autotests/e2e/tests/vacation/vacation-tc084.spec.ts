import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc084Data } from "../../data/vacation/VacationTc084Data";
import { ApiVacationSetupFixture } from "../../fixtures/ApiVacationSetupFixture";
import { DbClient } from "../../config/db/dbClient";
import { getDbTimestamp } from "../../data/vacation/queries/vacationNotificationQueries";

/**
 * TC-VAC-084: Regression — Calendar change converts ALL vacations (#3338).
 * Creates two APPROVED vacations in different months, then modifies
 * the production calendar for a date within only the FIRST vacation.
 * Verifies that only the affected vacation is reconverted, not both.
 *
 * Bug #3338 (CLOSED): Calendar change should only affect the vacation
 * containing the changed date, not all employee vacations.
 * This is a regression test to verify the fix holds.
 *
 * Calendar-vacation interaction:
 * Phase 1 (immediate): Calendar change increases working days → check annual days → convert if exceeded
 * Phase 2 (10 min delay): Check accrued days for affected payment month and later → convert if insufficient
 */
test("TC-VAC-084: Calendar change converts ALL vacations (#3338) @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc084Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const setup = new ApiVacationSetupFixture(request, tttConfig);
  const db = new DbClient(tttConfig);
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  let vacationId1: number | undefined;
  let vacationId2: number | undefined;
  let calendarEntryCreated = false;
  // The date we'll mark as a holiday (a Wednesday within vacation1)
  const holidayDate = (() => {
    const start = new Date(data.startDate1 + "T12:00:00Z");
    const wed = new Date(start);
    wed.setUTCDate(start.getUTCDate() + 2); // Wednesday of the Mon-Fri week
    return wed.toISOString().slice(0, 10);
  })();

  try {
    // Create two APPROVED vacations in different months
    const vacation1 = await setup.createAndApprove(
      data.startDate1,
      data.endDate1,
      "REGULAR",
    );
    vacationId1 = vacation1.id;

    const vacation2 = await setup.createAndApprove(
      data.startDate2,
      data.endDate2,
      "REGULAR",
    );
    vacationId2 = vacation2.id;

    // Record both vacations' payment_type before calendar change
    const before1 = await db.queryOne<{ payment_type: string; regular_days: number }>(
      `SELECT payment_type, regular_days FROM ttt_vacation.vacation WHERE id = $1`,
      [vacationId1],
    );
    const before2 = await db.queryOne<{ payment_type: string; regular_days: number }>(
      `SELECT payment_type, regular_days FROM ttt_vacation.vacation WHERE id = $1`,
      [vacationId2],
    );

    console.log(
      `[TC-VAC-084] Before calendar change:`,
    );
    console.log(
      `  Vacation1 (${data.startDate1}–${data.endDate1}): type=${before1.payment_type}, regularDays=${before1.regular_days}`,
    );
    console.log(
      `  Vacation2 (${data.startDate2}–${data.endDate2}): type=${before2.payment_type}, regularDays=${before2.regular_days}`,
    );

    // Add a holiday to the production calendar on a date within vacation1
    // This should trigger vacation-calendar interaction logic
    const calendarResp = await request.post(
      tttConfig.buildUrl("/api/calendar/v1/production-calendars"),
      {
        headers,
        data: {
          calendarId: data.calendarId,
          date: holidayDate,
          hours: 0,
          description: "TC-VAC-084 test holiday",
        },
      },
    );

    if (!calendarResp.ok()) {
      const body = await calendarResp.text();
      console.log(
        `[TC-VAC-084] Calendar entry creation failed: ${calendarResp.status()} ${body}`,
      );
      // Try PUT (create-or-update) as fallback
      const putResp = await request.put(
        tttConfig.buildUrl("/api/calendar/v1/production-calendars"),
        {
          headers,
          data: {
            calendarId: data.calendarId,
            date: holidayDate,
            hours: 0,
            description: "TC-VAC-084 test holiday",
          },
        },
      );
      if (!putResp.ok()) {
        const putBody = await putResp.text();
        test.skip(
          true,
          `Cannot modify production calendar: POST=${calendarResp.status()}, PUT=${putResp.status()}. ${putBody}`,
        );
        return;
      }
    }
    calendarEntryCreated = true;

    // Wait for the calendar change to propagate and trigger vacation recalculation
    // Phase 1 should be immediate, but allow time for async processing
    await new Promise((r) => setTimeout(r, 5000));

    // Check both vacations' payment_type AFTER calendar change
    const after1 = await db.queryOne<{ payment_type: string; regular_days: number }>(
      `SELECT payment_type, regular_days FROM ttt_vacation.vacation WHERE id = $1`,
      [vacationId1],
    );
    const after2 = await db.queryOne<{ payment_type: string; regular_days: number }>(
      `SELECT payment_type, regular_days FROM ttt_vacation.vacation WHERE id = $1`,
      [vacationId2],
    );

    console.log(
      `[TC-VAC-084] After calendar change (holiday on ${holidayDate}):`,
    );
    console.log(
      `  Vacation1 (${data.startDate1}–${data.endDate1}): type=${after1.payment_type}, regularDays=${after1.regular_days}`,
    );
    console.log(
      `  Vacation2 (${data.startDate2}–${data.endDate2}): type=${after2.payment_type}, regularDays=${after2.regular_days}`,
    );

    // Bug #3338 check: vacation2 should NOT be affected by a calendar change
    // that only touches dates within vacation1
    const vacation2TypeChanged = before2.payment_type !== after2.payment_type;
    const vacation2DaysChanged = before2.regular_days !== after2.regular_days;

    if (vacation2TypeChanged || vacation2DaysChanged) {
      console.log(
        `[BUG #3338 REGRESSION] Vacation2 was affected by calendar change in vacation1's date range!`,
      );
      console.log(
        `  Vacation2 type: ${before2.payment_type} → ${after2.payment_type}`,
      );
      console.log(
        `  Vacation2 regularDays: ${before2.regular_days} → ${after2.regular_days}`,
      );
    }

    // Vacation2 should remain unchanged (bug #3338 fix)
    expect(
      after2.payment_type,
      `Bug #3338 regression: Vacation2 payment_type should remain "${before2.payment_type}" but changed to "${after2.payment_type}" after calendar change in vacation1's date range`,
    ).toBe(before2.payment_type);

    expect(
      after2.regular_days,
      `Bug #3338 regression: Vacation2 regular_days should remain ${before2.regular_days} but changed to ${after2.regular_days}`,
    ).toBe(before2.regular_days);

    // Cleanup: cancel and delete vacations
    await setup.cancelVacation(vacationId1);
    await setup.deleteVacation(vacationId1);
    vacationId1 = undefined;

    await setup.cancelVacation(vacationId2);
    await setup.deleteVacation(vacationId2);
    vacationId2 = undefined;

    // Cleanup: remove the test calendar entry
    if (calendarEntryCreated) {
      await request.delete(
        tttConfig.buildUrl(
          `/api/calendar/v1/production-calendars/${data.calendarId}/${holidayDate}`,
        ),
        { headers },
      );
      calendarEntryCreated = false;
    }
  } finally {
    // Safety cleanup
    if (vacationId1) {
      await setup.cancelVacation(vacationId1).catch(() => {});
      await setup.deleteVacation(vacationId1).catch(() => {});
    }
    if (vacationId2) {
      await setup.cancelVacation(vacationId2).catch(() => {});
      await setup.deleteVacation(vacationId2).catch(() => {});
    }
    if (calendarEntryCreated) {
      await request
        .delete(
          tttConfig.buildUrl(
            `/api/calendar/v1/production-calendars/${data.calendarId}/${holidayDate}`,
          ),
          { headers },
        )
        .catch(() => {});
    }
    await db.close();
  }
});
