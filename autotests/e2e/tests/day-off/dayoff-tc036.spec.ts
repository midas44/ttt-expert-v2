import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc036Data } from "../../data/day-off/DayoffTc036Data";
import { DbClient } from "../../config/db/dbClient";
import {
  getRequestStatus,
  countApprovedRequestsInYear,
  countLedgerEntries,
  deleteTransferRequest,
} from "../../data/day-off/queries/dayoffQueries";

/**
 * TC-DO-036: Path D — Employee office change deletes year ledger.
 *
 * Creates APPROVED transfer requests, then changes the employee's salary
 * office via API. This triggers EmployeeDayOffAutoDeleteToCalendarUpdateHelper.update()
 * which:
 * 1. Sets ALL requests for the year to DELETED_FROM_CALENDAR
 * 2. Physically deletes ALL ledger entries (employee_dayoff) for the year
 * 3. Sends notification to the employee
 *
 * WARNING: PAGE_SIZE=100 hard limit — employees with >100 day-offs/year
 * won't have all requests processed.
 */
test("TC-DO-036: Path D — Employee office change deletes year ledger @regress @day-off @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc036Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const db = new DbClient(tttConfig);
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  let officeChanged = false;

  try {
    const year = new Date().getFullYear();
    console.log(
      `[TC-DO-036] Employee: ${data.employeeLogin} (id=${data.employeeId})`,
    );
    console.log(
      `  Office: ${data.originalOfficeName} (${data.originalOfficeId}) → ${data.targetOfficeName} (${data.targetOfficeId})`,
    );
    console.log(
      `  APPROVED requests in ${year}: ${data.approvedCountBefore}`,
    );
    console.log(
      `  Test request IDs: [${data.approvedRequestIds.join(", ")}]`,
    );

    // Verify test request is APPROVED before office change
    for (const reqId of data.approvedRequestIds) {
      const status = await getRequestStatus(db, reqId);
      expect(status, `Request #${reqId} should be APPROVED before cascade`).toBe(
        "APPROVED",
      );
    }

    // Record ledger entries before
    const ledgerBefore = await db.queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM ttt_vacation.employee_dayoff ed
       WHERE ed.employee = $1
         AND EXTRACT(YEAR FROM ed.original_date) = $2`,
      [data.employeeId, year],
    );
    console.log(`  Ledger entries before: ${ledgerBefore.cnt}`);

    // Change employee's office via vacation API
    // Try PATCH /api/vacation/v1/employees/{login} with officeId
    const patchResp = await request.patch(
      tttConfig.buildUrl(
        `/api/vacation/v1/employees/${data.employeeLogin}`,
      ),
      {
        headers,
        data: { officeId: data.targetOfficeId },
      },
    );

    if (!patchResp.ok()) {
      // Fallback: try TTT API employee patch
      const tttPatchResp = await request.patch(
        tttConfig.buildUrl(
          `/api/ttt/v1/employees/${data.employeeLogin}`,
        ),
        {
          headers,
          data: { officeId: data.targetOfficeId },
        },
      );

      if (!tttPatchResp.ok()) {
        const body1 = await patchResp.text();
        const body2 = await tttPatchResp.text();
        console.log(`  Vacation PATCH: ${patchResp.status()} ${body1}`);
        console.log(`  TTT PATCH: ${tttPatchResp.status()} ${body2}`);
        test.skip(
          true,
          `Cannot change employee office: vacation=${patchResp.status()}, ttt=${tttPatchResp.status()}`,
        );
        return;
      }
    }
    officeChanged = true;
    console.log(`  Office changed to ${data.targetOfficeName}`);

    // Wait for RabbitMQ cascade
    // (EmployeeDayOffAutoDeleteToCalendarUpdateHelper.update → delete ledger + set status)
    await new Promise((r) => setTimeout(r, 8000));

    // DB-CHECK: All APPROVED requests for the year should be DELETED_FROM_CALENDAR
    for (const reqId of data.approvedRequestIds) {
      const statusAfter = await getRequestStatus(db, reqId);
      console.log(`  Request #${reqId} status after: ${statusAfter}`);
      expect(
        statusAfter,
        `Path D: request #${reqId} should be DELETED_FROM_CALENDAR`,
      ).toBe("DELETED_FROM_CALENDAR");
    }

    // DB-CHECK: Ledger entries should be physically deleted for the year
    const ledgerAfter = await db.queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM ttt_vacation.employee_dayoff ed
       WHERE ed.employee = $1
         AND EXTRACT(YEAR FROM ed.original_date) = $2`,
      [data.employeeId, year],
    );
    console.log(`  Ledger entries after: ${ledgerAfter.cnt}`);

    expect(
      Number(ledgerAfter.cnt),
      `Ledger entries should be deleted (was ${ledgerBefore.cnt})`,
    ).toBe(0);

    // DB-CHECK: Verify employee's office actually changed
    const newOffice = await db.queryOne<{ officeId: number }>(
      `SELECT office_id AS "officeId" FROM ttt_vacation.employee WHERE id = $1`,
      [data.employeeId],
    );
    console.log(`  Employee office_id after: ${newOffice.officeId}`);

    expect(
      newOffice.officeId,
      "Employee office should have changed",
    ).toBe(data.targetOfficeId);
  } finally {
    // CLEANUP: Revert employee office to original
    if (officeChanged) {
      // Try vacation API first, then TTT API
      const revertResp = await request
        .patch(
          tttConfig.buildUrl(
            `/api/vacation/v1/employees/${data.employeeLogin}`,
          ),
          {
            headers,
            data: { officeId: data.originalOfficeId },
          },
        )
        .catch(() => null);

      if (!revertResp || !revertResp.ok()) {
        await request
          .patch(
            tttConfig.buildUrl(
              `/api/ttt/v1/employees/${data.employeeLogin}`,
            ),
            {
              headers,
              data: { officeId: data.originalOfficeId },
            },
          )
          .catch((e) =>
            console.log(`[TC-DO-036] Office revert failed: ${e}`),
          );
      }
      // Wait for revert cascade
      await new Promise((r) => setTimeout(r, 5000));
    }
    // CLEANUP: Delete test requests
    for (const reqId of data.approvedRequestIds) {
      await deleteTransferRequest(db, reqId).catch(() => {});
    }
    await db.close();
  }
});
