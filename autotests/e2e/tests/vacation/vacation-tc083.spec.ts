import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc083Data } from "../../data/vacation/VacationTc083Data";
import { DbClient } from "../../config/db/dbClient";

/**
 * TC-VAC-083: Null optionalApprovers → NPE on CPO path.
 * Confirmed active: optionalApprovers field has no @NotNull annotation.
 * When a CPO creates a vacation, VacationServiceImpl calls
 *   request.getOptionalApprovers().add(manager.getLogin())
 * which throws NPE if optionalApprovers is null.
 * Verifies HTTP 500 response and no vacation created.
 */
test("TC-VAC-083: Null optionalApprovers → NPE on CPO path @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc083Data.create(
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

  // Step 1: POST vacation with optionalApprovers: null (triggers NPE on CPO path)
  const url = tttConfig.buildUrl("/api/vacation/v1/vacations");
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };
  const paymentMonth = `${data.startDateIso.slice(0, 8)}01`;

  const resp = await request.post(url, {
    headers,
    data: {
      login: data.username,
      startDate: data.startDateIso,
      endDate: data.endDateIso,
      paymentType: "REGULAR",
      paymentMonth,
      optionalApprovers: null,
      notifyAlso: [],
    },
  });

  // Step 2: Verify HTTP 500 (NPE — no @NotNull on optionalApprovers DTO field)
  expect(resp.status(), "Expected 500 for null optionalApprovers (NPE bug)").toBe(500);

  // Step 3: DB-CHECK — verify no vacation was created
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
    expect(
      Number(afterRow.cnt),
      `Vacation count should not increase after 500 (baseline=${baselineCount})`,
    ).toBe(baselineCount);
  } finally {
    await db2.close();
  }
});
