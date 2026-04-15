import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc043Data } from "../../data/vacation/VacationTc043Data";
import { DbClient } from "@ttt/config/db/dbClient";

/**
 * TC-VAC-043: Null paymentMonth → server error (NPE bug).
 * Confirmed active: AbstractVacationRequestDTO.paymentMonth has no @NotNull annotation.
 * POSTing with paymentMonth: null triggers NPE in correctPaymentMonth().
 * Verifies HTTP 500 response.
 */
test("TC-VAC-043: Null paymentMonth → server error (NPE bug) @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc043Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // Baseline: count existing vacations with these dates
  const db = new DbClient(tttConfig);
  let baselineCount = 0;
  try {
    const baseRow = await db.queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM ttt_vacation.vacation v
       JOIN ttt_vacation.employee e ON v.employee = e.id
       WHERE e.login = $1
         AND v.start_date = $2::date
         AND v.end_date = $3::date
         AND v.status NOT IN ('DELETED')`,
      [data.username, data.startDateIso, data.endDateIso],
    );
    baselineCount = Number(baseRow.cnt);
  } finally {
    await db.close();
  }

  // Step 1: POST vacation with paymentMonth: null (triggers NPE)
  const url = tttConfig.buildUrl("/api/vacation/v1/vacations");
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  const resp = await request.post(url, {
    headers,
    data: {
      login: data.username,
      startDate: data.startDateIso,
      endDate: data.endDateIso,
      paymentType: "REGULAR",
      paymentMonth: null,
      optionalApprovers: [],
      notifyAlso: [],
    },
  });

  // Step 2: Verify HTTP 500 (NPE — no @NotNull on paymentMonth DTO field)
  expect(resp.status(), "Expected 500 for null paymentMonth (NPE bug)").toBe(
    500,
  );

  // Step 3: DB-CHECK — verify no NEW vacation was created (compare to baseline)
  const db2 = new DbClient(tttConfig);
  try {
    const afterRow = await db2.queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM ttt_vacation.vacation v
       JOIN ttt_vacation.employee e ON v.employee = e.id
       WHERE e.login = $1
         AND v.start_date = $2::date
         AND v.end_date = $3::date
         AND v.status NOT IN ('DELETED')`,
      [data.username, data.startDateIso, data.endDateIso],
    );
    const afterCount = Number(afterRow.cnt);

    // The count should not have increased (500 = no creation)
    expect(
      afterCount,
      `Vacation count should not increase after 500 error (baseline=${baselineCount})`,
    ).toBe(baselineCount);
  } finally {
    await db2.close();
  }
});
