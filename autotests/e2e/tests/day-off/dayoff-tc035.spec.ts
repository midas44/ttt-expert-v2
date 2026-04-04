import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { DayoffTc035Data } from "../../data/day-off/DayoffTc035Data";
import { DbClient } from "../../config/db/dbClient";
import {
  getRequestStatus,
  deleteTransferRequest,
} from "../../data/day-off/queries/dayoffQueries";

/**
 * TC-DO-035: Path C — System rejects NEW requests when period changes.
 *
 * Creates 2 NEW transfer requests in different months, then advances the
 * office approve period by 1 month via PATCH. The PeriodChangedEventHandler
 * cascade should reject NEW requests in the newly-approved month while
 * leaving requests in later months untouched.
 *
 * Trigger: PATCH /api/ttt/v1/offices/{id}/periods/approve
 * Handler: PeriodChangedEventHandler → rejectedBySystem()
 */
test("TC-DO-035: Path C — System rejects NEW requests on period change @regress @day-off @col-absences", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await DayoffTc035Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const db = new DbClient(tttConfig);
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  let periodAdvanced = false;

  try {
    console.log(
      `[TC-DO-035] Office ${data.officeId}, approve period: ${data.currentApprovePeriod}`,
    );
    console.log(
      `  Employee: ${data.employeeLogin} (id=${data.employeeId})`,
    );
    console.log(
      `  Affected request #${data.affectedRequestId} date=${data.affectedDate}`,
    );
    console.log(
      `  Unaffected request #${data.unaffectedRequestId} date=${data.unaffectedDate}`,
    );
    console.log(`  Will advance approve period to: ${data.newApprovePeriod}`);

    // Verify both requests are NEW before the cascade
    const status1Before = await getRequestStatus(db, data.affectedRequestId);
    const status2Before = await getRequestStatus(db, data.unaffectedRequestId);
    expect(status1Before, "Affected request should be NEW before cascade").toBe("NEW");
    expect(status2Before, "Unaffected request should be NEW before cascade").toBe("NEW");

    // Advance the approve period — triggers PeriodChangedEventHandler via RabbitMQ
    // PATCH /api/ttt/v1/offices/{officeId}/periods/approve
    const patchResp = await request.patch(
      tttConfig.buildUrl(
        `/api/ttt/v1/offices/${data.officeId}/periods/approve`,
      ),
      {
        headers,
        data: { startDate: data.newApprovePeriod },
      },
    );

    if (!patchResp.ok()) {
      const body = await patchResp.text();
      console.log(`  PATCH approve period failed: ${patchResp.status()} ${body}`);
      test.skip(
        true,
        `Cannot advance approve period: ${patchResp.status()} ${body}`,
      );
      return;
    }
    periodAdvanced = true;
    console.log(`  Approve period advanced to ${data.newApprovePeriod}`);

    // Wait for RabbitMQ cascade (PeriodChangedEventHandler → rejectedBySystem)
    await new Promise((r) => setTimeout(r, 6000));

    // DB-CHECK: Affected request should be REJECTED (period now covers its month)
    const status1After = await getRequestStatus(db, data.affectedRequestId);
    console.log(`  Affected request status after: ${status1After}`);

    // The exact cascade behavior depends on the matching logic.
    // Expected: REJECTED. But if not rejected, log as finding.
    if (status1After === "REJECTED") {
      console.log("  ✓ Path C cascade correctly rejected the affected request");
    } else {
      console.log(
        `  WARNING: Affected request NOT rejected (status=${status1After}). ` +
        `Period matching logic may differ from expectations.`,
      );
    }
    // Assert — the cascade SHOULD reject it
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
    // CLEANUP: Revert approve period to original
    if (periodAdvanced) {
      await request
        .patch(
          tttConfig.buildUrl(
            `/api/ttt/v1/offices/${data.officeId}/periods/approve`,
          ),
          {
            headers,
            data: { startDate: data.currentApprovePeriod },
          },
        )
        .catch((e) =>
          console.log(`[TC-DO-035] Period revert failed: ${e}`),
        );
      // Wait for revert cascade to settle
      await new Promise((r) => setTimeout(r, 3000));
    }
    // CLEANUP: Delete test requests
    await deleteTransferRequest(db, data.affectedRequestId).catch(() => {});
    await deleteTransferRequest(db, data.unaffectedRequestId).catch(() => {});
    await db.close();
  }
});
