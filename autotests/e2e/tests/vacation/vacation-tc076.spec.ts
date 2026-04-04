import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc076Data } from "../../data/vacation/VacationTc076Data";
import { DbClient } from "../../config/db/dbClient";

/**
 * TC-VAC-076: Regression — last_date not updated during CS sync (#3374).
 * Pure DB verification test. Triggers employee sync via both TTT and vacation
 * test endpoints, then checks last_date consistency between schemas.
 *
 * Bug #3374 (OPEN, Sprint 15): The CS sync does not propagate last_date
 * to ttt_vacation.employee, so employees can create vacations beyond
 * their termination date.
 *
 * Root cause: Both services sync from CompanyStaff independently via
 * separate CSEmployeeSynchronizer implementations, but ttt_vacation's
 * sync simply does not update last_date.
 */
test("TC-VAC-076: last_date not updated during CS sync (#3374) @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc076Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const db = new DbClient(tttConfig);
  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  try {
    // Try to trigger employee sync endpoints (best-effort — may return 401/500)
    // TTT test sync endpoint requires fullSync param
    const tttSyncResp = await request.post(
      tttConfig.buildUrl("/api/ttt/test/v1/employees/sync?fullSync=false"),
      { headers },
    );
    console.log(
      `[TC-VAC-076] TTT employee sync: ${tttSyncResp.status()}`,
    );

    // Vacation employee sync via vacation test endpoint
    const vacSyncResp = await request.post(
      tttConfig.buildUrl("/api/vacation/v1/test/sync"),
      { headers },
    );
    console.log(
      `[TC-VAC-076] Vacation employee sync: ${vacSyncResp.status()}`,
    );

    // Wait for any sync to complete
    if (tttSyncResp.ok() || vacSyncResp.ok()) {
      await new Promise((r) => setTimeout(r, 8000));
    }

    // Check mismatches between schemas AFTER sync attempt
    // Critical case: backend has last_date but vacation doesn't
    const criticalMismatches = await db.query<{
      login: string;
      backend_last_date: string | null;
      vacation_last_date: string | null;
    }>(
      `SELECT be.login,
              be.last_date::text AS backend_last_date,
              ve.last_date::text AS vacation_last_date
       FROM ttt_backend.employee be
       JOIN ttt_vacation.employee ve ON be.login = ve.login
       WHERE be.last_date IS NOT NULL
         AND ve.last_date IS NULL
         AND be.enabled = true
       ORDER BY be.last_date DESC
       LIMIT 20`,
    );

    console.log(
      `[TC-VAC-076] Critical mismatches (backend has last_date, vacation NULL): ${criticalMismatches.length}`,
    );
    for (const row of criticalMismatches.slice(0, 10)) {
      console.log(
        `  ${row.login}: backend=${row.backend_last_date}, vacation=${row.vacation_last_date}`,
      );
    }

    // Also check reverse: vacation has stale last_date, backend doesn't
    const staleMismatches = await db.query<{
      login: string;
      backend_last_date: string | null;
      vacation_last_date: string | null;
    }>(
      `SELECT be.login,
              be.last_date::text AS backend_last_date,
              ve.last_date::text AS vacation_last_date
       FROM ttt_backend.employee be
       JOIN ttt_vacation.employee ve ON be.login = ve.login
       WHERE be.last_date IS NULL
         AND ve.last_date IS NOT NULL
         AND be.enabled = true
       ORDER BY ve.last_date DESC
       LIMIT 20`,
    );

    console.log(
      `[TC-VAC-076] Stale mismatches (backend NULL, vacation has date): ${staleMismatches.length}`,
    );

    const totalMismatches = criticalMismatches.length + staleMismatches.length;

    if (totalMismatches > 0) {
      console.log(
        `[BUG #3374 CONFIRMED] ${totalMismatches} total last_date mismatches between schemas.`,
      );
      if (criticalMismatches.length > 0) {
        console.log(
          `[BUG #3374 CRITICAL] ${criticalMismatches.length} employees have termination date in backend but vacation service is unaware — ` +
          `they can create vacations past their leave date.`,
        );
      }
    }

    // Bug #3374: last_date should be consistent between schemas after sync
    // This assertion will FAIL as long as the bug exists (expected behavior for open bug)
    expect(
      totalMismatches,
      `Bug #3374: ${totalMismatches} employees have mismatched last_date between ttt_backend and ttt_vacation (${criticalMismatches.length} critical, ${staleMismatches.length} stale)`,
    ).toBe(0);
  } finally {
    await db.close();
  }
});
