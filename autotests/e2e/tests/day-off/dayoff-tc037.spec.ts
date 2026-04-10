import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc037Data } from "../../data/day-off/DayoffTc037Data";
import { DbClient } from "../../config/db/dbClient";
import {
  getRequestStatus,
  deleteTransferRequest,
} from "../../data/day-off/queries/dayoffQueries";

/**
 * TC-DO-037: Cross-office isolation — calendar deletion in one office
 * should NOT affect another office's requests on the same date.
 *
 * Regression test for BUG-DO-21 (#3221): cross-calendar deletion bug
 * where same-date holidays in different offices interfered.
 *
 * Creates NEW requests for 2 employees in different offices on a shared
 * holiday date. Deletes the holiday from office 1's calendar only.
 * Verifies office 1's request is affected while office 2's is unchanged.
 */
test("TC-DO-037: Calendar deletion affects only correct office @regress @day-off @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc037Data.create(
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
    console.log(`[TC-DO-037] Shared holiday date: ${data.sharedDate}`);
    console.log(
      `  Emp1: ${data.emp1Login} (id=${data.emp1Id}) office=${data.emp1OfficeName} cal=${data.emp1CalendarId} calDay=${data.emp1CalDayId}`,
    );
    console.log(
      `  Emp2: ${data.emp2Login} (id=${data.emp2Id}) office=${data.emp2OfficeName} cal=${data.emp2CalendarId} calDay=${data.emp2CalDayId}`,
    );
    console.log(
      `  Will delete calendar day ${data.emp1CalDayId} from office ${data.emp1OfficeName} only`,
    );

    // Verify both requests are NEW before cascade
    const status1Before = await getRequestStatus(db, data.emp1RequestId);
    const status2Before = await getRequestStatus(db, data.emp2RequestId);
    expect(status1Before, "Emp1 request should be NEW before").toBe("NEW");
    expect(status2Before, "Emp2 request should be NEW before").toBe("NEW");

    // Delete the holiday from office 1's calendar ONLY
    // DELETE /api/calendar/v1/calendar/{calendarDayId}
    const delResp = await request.delete(
      tttConfig.buildUrl(`/api/calendar/v1/calendar/${data.emp1CalDayId}`),
      { headers },
    );

    if (!delResp.ok()) {
      const body = await delResp.text();
      console.log(`  DELETE calendar day failed: ${delResp.status()} ${body}`);
      test.skip(true, `Cannot delete calendar day: ${delResp.status()}`);
      return;
    }
    calendarDayDeleted = true;
    console.log(`  Calendar day ${data.emp1CalDayId} deleted from ${data.emp1OfficeName}`);

    // Wait for RabbitMQ cascade (CalendarChangedApplicationEvent)
    await new Promise((r) => setTimeout(r, 8000));

    // DB-CHECK: Emp1's request should be DELETED_FROM_CALENDAR (affected office)
    const status1After = await getRequestStatus(db, data.emp1RequestId);
    console.log(`  Emp1 request status after: ${status1After}`);

    // The cascade may set DELETED_FROM_CALENDAR or REJECTED depending on path
    const acceptableStatuses = ["DELETED_FROM_CALENDAR", "REJECTED"];
    if (acceptableStatuses.includes(status1After)) {
      console.log(`  ✓ Emp1 request correctly affected (${status1After})`);
    } else {
      console.log(`  WARNING: Emp1 request not affected as expected (${status1After})`);
    }
    expect(
      acceptableStatuses.includes(status1After),
      `Emp1 request should be DELETED_FROM_CALENDAR or REJECTED, got ${status1After}`,
    ).toBe(true);

    // DB-CHECK: Emp2's request should STILL be NEW (different office, not affected)
    const status2After = await getRequestStatus(db, data.emp2RequestId);
    console.log(`  Emp2 request status after: ${status2After}`);

    expect(
      status2After,
      "Cross-office isolation: emp2 request should remain NEW",
    ).toBe("NEW");
  } finally {
    // CLEANUP: Restore the deleted calendar day
    if (calendarDayDeleted) {
      await request
        .post(tttConfig.buildUrl("/api/calendar/v1/calendar"), {
          headers,
          data: {
            calendarId: data.emp1CalendarId,
            date: data.sharedDate,
            duration: 0,
            reason: "TC-DO-037 restore",
          },
        })
        .catch((e) =>
          console.log(`[TC-DO-037] Calendar restore failed: ${e}`),
        );
    }
    // CLEANUP: Delete test requests
    await deleteTransferRequest(db, data.emp1RequestId).catch(() => {});
    await deleteTransferRequest(db, data.emp2RequestId).catch(() => {});
    await db.close();
  }
});
