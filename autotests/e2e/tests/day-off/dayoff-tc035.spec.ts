import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc035Data } from "../../data/day-off/DayoffTc035Data";
import { DbClient } from "../../config/db/dbClient";
import { LoginFixture } from "../../fixtures/LoginFixture";
import {
  getRequestStatus,
  deleteTransferRequest,
} from "../../data/day-off/queries/dayoffQueries";

/**
 * TC-DO-035: Path C — System rejects NEW requests when period changes.
 *
 * Creates 2 NEW transfer requests in different months, then advances the
 * office approve period by 1 month. Both period PATCHes require
 * AUTHENTICATED_USER (JWT), obtained via CAS login as admin.
 *
 * Since approve period can't exceed report period, the test advances
 * report first, then approve. The PeriodChangedEventHandler cascade
 * should reject NEW requests in the newly-approved month.
 *
 * Trigger: PATCH /api/ttt/v1/offices/{id}/periods/approve
 * Handler: PeriodChangedEventHandler → rejectedBySystem()
 */
test("TC-DO-035: Path C — System rejects NEW requests on period change @regress @day-off @col-absences", async ({
  page,
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc035Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const db = new DbClient(tttConfig);

  // Login as admin via CAS to obtain JWT for period PATCH endpoints
  const login = new LoginFixture(page, tttConfig);
  await login.run();
  const jwt = await page.evaluate(() => localStorage.getItem("id_token"));
  if (!jwt) {
    test.skip(true, "Could not extract JWT from localStorage after login");
    await db.close();
    return;
  }

  const headers = {
    TTT_JWT_TOKEN: jwt,
    "Content-Type": "application/json",
  };

  let reportAdvanced = false;
  let approveAdvanced = false;

  try {
    console.log(
      `[TC-DO-035] Office ${data.officeId}, approve=${data.currentApprovePeriod}, report=${data.currentReportPeriod}`,
    );
    console.log(`  Employee: ${data.employeeLogin} (id=${data.employeeId})`);
    console.log(`  Affected request #${data.affectedRequestId} date=${data.affectedDate}`);
    console.log(`  Unaffected request #${data.unaffectedRequestId} date=${data.unaffectedDate}`);
    console.log(`  Will advance both periods to: ${data.newPeriod}`);

    // Verify both requests are NEW before the cascade
    const status1Before = await getRequestStatus(db, data.affectedRequestId);
    const status2Before = await getRequestStatus(db, data.unaffectedRequestId);
    expect(status1Before, "Affected request should be NEW before cascade").toBe("NEW");
    expect(status2Before, "Unaffected request should be NEW before cascade").toBe("NEW");

    // Step 1: Advance REPORT period first (approve can't exceed report)
    const reportResp = await request.patch(
      tttConfig.buildUrl(`/api/ttt/v1/offices/${data.officeId}/periods/report`),
      { headers, data: { start: data.newPeriod } },
    );

    if (!reportResp.ok()) {
      const body = await reportResp.text();
      console.log(`  PATCH report period failed: ${reportResp.status()} ${body}`);
      test.skip(true, `Cannot advance report period: ${reportResp.status()}`);
      return;
    }
    reportAdvanced = true;
    console.log(`  Report period advanced to ${data.newPeriod}`);

    // Step 2: Advance APPROVE period — triggers PeriodChangedEventHandler
    const approveResp = await request.patch(
      tttConfig.buildUrl(`/api/ttt/v1/offices/${data.officeId}/periods/approve`),
      { headers, data: { start: data.newPeriod } },
    );

    if (!approveResp.ok()) {
      const body = await approveResp.text();
      console.log(`  PATCH approve period failed: ${approveResp.status()} ${body}`);
      test.skip(true, `Cannot advance approve period: ${approveResp.status()}`);
      return;
    }
    approveAdvanced = true;
    console.log(`  Approve period advanced to ${data.newPeriod}`);

    // Wait for RabbitMQ cascade (PeriodChangedEventHandler → rejectedBySystem)
    await new Promise((r) => setTimeout(r, 8000));

    // DB-CHECK: Affected request should be REJECTED (period now covers its month)
    const status1After = await getRequestStatus(db, data.affectedRequestId);
    console.log(`  Affected request status after: ${status1After}`);

    if (status1After === "REJECTED") {
      console.log("  ✓ Path C cascade correctly rejected the affected request");
    } else {
      console.log(
        `  WARNING: Affected request NOT rejected (status=${status1After}). ` +
        `Period matching logic may differ from expectations.`,
      );
    }
    expect(
      status1After,
      "Path C: affected request should be REJECTED after period advance",
    ).toBe("REJECTED");

    // DB-CHECK: Unaffected request should still be NEW
    const status2After = await getRequestStatus(db, data.unaffectedRequestId);
    console.log(`  Unaffected request status after: ${status2After}`);

    expect(
      status2After,
      "Unaffected request in later month should remain NEW",
    ).toBe("NEW");
  } finally {
    // CLEANUP: Revert periods in reverse order (approve first, then report)
    if (approveAdvanced) {
      await request
        .patch(
          tttConfig.buildUrl(`/api/ttt/v1/offices/${data.officeId}/periods/approve`),
          { headers, data: { start: data.currentApprovePeriod } },
        )
        .catch((e) => console.log(`[TC-DO-035] Approve revert failed: ${e}`));
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (reportAdvanced) {
      await request
        .patch(
          tttConfig.buildUrl(`/api/ttt/v1/offices/${data.officeId}/periods/report`),
          { headers, data: { start: data.currentReportPeriod } },
        )
        .catch((e) => console.log(`[TC-DO-035] Report revert failed: ${e}`));
      await new Promise((r) => setTimeout(r, 2000));
    }
    // CLEANUP: Delete test requests
    await deleteTransferRequest(db, data.affectedRequestId).catch(() => {});
    await deleteTransferRequest(db, data.unaffectedRequestId).catch(() => {});
    await db.close();
  }
});
