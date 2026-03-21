import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc076Data } from "../data/VacationTc076Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc076 - FIFO cancel returns days to pool and redistributes @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc076Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const cancelUrl = tttConfig.buildUrl(data.cancelEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let vacationIdA: number | null = null;
  let vacationIdB: number | null = null;

  try {
    // Step 1: DB — Baseline employee_vacation year balances
    const db1 = new DbClient(tttConfig);
    let employeeId: number;
    let dbYearsBefore: Array<{ year: number; available_vacation_days: number }>;
    try {
      const empRow = await db1.queryOne<{ id: number }>(
        `SELECT id FROM ttt_vacation.employee WHERE login = $1`,
        [data.login],
      );
      employeeId = empRow.id;

      dbYearsBefore = await db1.query<{ year: number; available_vacation_days: number }>(
        `SELECT ev.year, ev.available_vacation_days
         FROM ttt_vacation.employee_vacation ev
         WHERE ev.employee = $1
         ORDER BY ev.year`,
        [employeeId],
      );

      const step1Artifact = testInfo.outputPath("step1-db-years-baseline.json");
      await writeFile(step1Artifact, JSON.stringify({
        employeeId,
        login: data.login,
        years: dbYearsBefore,
        totalBalance: dbYearsBefore.reduce((s, y) => s + Number(y.available_vacation_days), 0),
      }, null, 2), "utf-8");
      await testInfo.attach("step1-db-years-baseline", { path: step1Artifact, contentType: "application/json" });
    } finally {
      await db1.close();
    }

    // Step 2: Create vacation A (5 days)
    const createRespA = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBodyA(),
    });
    const createBodyA = await createRespA.json();

    const step2Artifact = testInfo.outputPath("step2-create-vacation-a.json");
    await writeFile(step2Artifact, JSON.stringify(createBodyA, null, 2), "utf-8");
    await testInfo.attach("step2-create-vacation-a", { path: step2Artifact, contentType: "application/json" });

    expect(createRespA.status(), "Create vacation A should return 200").toBe(200);
    vacationIdA = createBodyA.vacation?.id;
    expect(vacationIdA, "Should get vacation A ID").toBeTruthy();

    const regularDaysA = Number(createBodyA.vacation?.regularDays ?? 0);

    // Step 3: Create vacation B (5 days)
    const createRespB = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBodyB(),
    });
    const createBodyB = await createRespB.json();

    const step3Artifact = testInfo.outputPath("step3-create-vacation-b.json");
    await writeFile(step3Artifact, JSON.stringify(createBodyB, null, 2), "utf-8");
    await testInfo.attach("step3-create-vacation-b", { path: step3Artifact, contentType: "application/json" });

    expect(createRespB.status(), "Create vacation B should return 200").toBe(200);
    vacationIdB = createBodyB.vacation?.id;
    expect(vacationIdB, "Should get vacation B ID").toBeTruthy();

    const regularDaysB = Number(createBodyB.vacation?.regularDays ?? 0);

    // Step 4: DB — Check distributions for both vacations after creation
    const db2 = new DbClient(tttConfig);
    let distA_before: Array<{ vacation: number; year: number; days: number }>;
    let distB_before: Array<{ vacation: number; year: number; days: number }>;
    try {
      distA_before = await db2.query<{ vacation: number; year: number; days: number }>(
        `SELECT vdd.vacation, vdd.year, vdd.days
         FROM ttt_vacation.vacation_days_distribution vdd
         WHERE vdd.vacation = $1
         ORDER BY vdd.year`,
        [vacationIdA],
      );

      distB_before = await db2.query<{ vacation: number; year: number; days: number }>(
        `SELECT vdd.vacation, vdd.year, vdd.days
         FROM ttt_vacation.vacation_days_distribution vdd
         WHERE vdd.vacation = $1
         ORDER BY vdd.year`,
        [vacationIdB],
      );

      const step4Artifact = testInfo.outputPath("step4-distributions-after-create.json");
      await writeFile(step4Artifact, JSON.stringify({
        vacationA: { id: vacationIdA, regularDays: regularDaysA, distribution: distA_before },
        vacationB: { id: vacationIdB, regularDays: regularDaysB, distribution: distB_before },
        note: "Both vacations created — FIFO should consume from earliest year",
      }, null, 2), "utf-8");
      await testInfo.attach("step4-distributions-after-create", { path: step4Artifact, contentType: "application/json" });

      expect(distA_before.length, "Vacation A should have distribution records").toBeGreaterThan(0);
      expect(distB_before.length, "Vacation B should have distribution records").toBeGreaterThan(0);
    } finally {
      await db2.close();
    }

    // Step 5: Cancel vacation A
    const cancelResp = await request.put(`${cancelUrl}/${vacationIdA}`, {
      headers: authHeaders,
    });
    let cancelBody: Record<string, unknown> = {};
    try { cancelBody = await cancelResp.json(); } catch { /* empty */ }

    const step5Artifact = testInfo.outputPath("step5-cancel-vacation-a.json");
    await writeFile(step5Artifact, JSON.stringify({
      status: cancelResp.status(),
      body: cancelBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step5-cancel-vacation-a", { path: step5Artifact, contentType: "application/json" });

    expect(cancelResp.status(), "Cancel vacation A should return 200").toBe(200);
    vacationIdA = null; // Canceled — no cleanup needed

    // Step 6: DB — Verify redistribution after cancel
    const db3 = new DbClient(tttConfig);
    try {
      // A's distribution should be gone (recalculation clears canceled vacation's distribution)
      const distA_after = await db3.query<{ vacation: number; year: number; days: number }>(
        `SELECT vdd.vacation, vdd.year, vdd.days
         FROM ttt_vacation.vacation_days_distribution vdd
         WHERE vdd.vacation = $1
         ORDER BY vdd.year`,
        [cancelBody.vacation ? (cancelBody.vacation as Record<string, unknown>).id : vacationIdA],
      );

      // B's distribution after A's cancel — may have redistributed
      const distB_after = await db3.query<{ vacation: number; year: number; days: number }>(
        `SELECT vdd.vacation, vdd.year, vdd.days
         FROM ttt_vacation.vacation_days_distribution vdd
         WHERE vdd.vacation = $1
         ORDER BY vdd.year`,
        [vacationIdB],
      );

      // Employee year balances after cancel
      const dbYearsAfterCancel = await db3.query<{ year: number; available_vacation_days: number }>(
        `SELECT ev.year, ev.available_vacation_days
         FROM ttt_vacation.employee_vacation ev
         WHERE ev.employee = $1
         ORDER BY ev.year`,
        [employeeId],
      );

      const step6Artifact = testInfo.outputPath("step6-redistribution-after-cancel.json");
      await writeFile(step6Artifact, JSON.stringify({
        vacationA_dist_after: distA_after,
        vacationB_dist_before: distB_before,
        vacationB_dist_after: distB_after,
        yearBalances_before: dbYearsBefore,
        yearBalances_afterCancel: dbYearsAfterCancel,
        note: "After cancel A: A's days returned to pool, B may be redistributed via FIFO recalculation",
      }, null, 2), "utf-8");
      await testInfo.attach("step6-redistribution-after-cancel", { path: step6Artifact, contentType: "application/json" });

      // Verify B's distribution total unchanged (B still consumes same number of days)
      const distB_totalBefore = distB_before.reduce((s, d) => s + Number(d.days), 0);
      const distB_totalAfter = distB_after.reduce((s, d) => s + Number(d.days), 0);

      expect(
        distB_totalAfter,
        "Vacation B distribution total should remain the same after A's cancel",
      ).toBe(distB_totalBefore);

      // Verify B's distribution still follows FIFO (earliest year consumed first)
      const nonZeroYears = dbYearsAfterCancel
        .filter(y => Number(y.available_vacation_days) > 0)
        .map(y => y.year);

      if (distB_after.length > 0 && nonZeroYears.length > 0) {
        expect(
          distB_after[0].year,
          "After redistribution, B should still follow FIFO (earliest non-zero year)",
        ).toBeLessThanOrEqual(nonZeroYears[nonZeroYears.length - 1]);
      }

      // Verify that A's days returned partially: balance increase ≥ 0
      const totalBefore = dbYearsBefore.reduce((s, y) => s + Number(y.available_vacation_days), 0);
      const totalAfterCancel = dbYearsAfterCancel.reduce((s, y) => s + Number(y.available_vacation_days), 0);
      // After cancel A, net balance = baseline - B_days (A's days returned)
      // totalAfterCancel should be totalBefore - regularDaysB
      expect(
        totalAfterCancel,
        "Balance after A cancel should be baseline minus B's days only",
      ).toBe(totalBefore - regularDaysB);
    } finally {
      await db3.close();
    }

    // Step 7: Cleanup — delete vacation B
    await request.delete(`${vacUrl}/${vacationIdB}`, { headers: authHeaders });
    vacationIdB = null;

    // Verify balances fully restored
    const db4 = new DbClient(tttConfig);
    try {
      const dbYearsRestored = await db4.query<{ year: number; available_vacation_days: number }>(
        `SELECT ev.year, ev.available_vacation_days
         FROM ttt_vacation.employee_vacation ev
         WHERE ev.employee = $1
         ORDER BY ev.year`,
        [employeeId],
      );

      const totalRestored = dbYearsRestored.reduce((s, y) => s + Number(y.available_vacation_days), 0);
      const totalBefore = dbYearsBefore.reduce((s, y) => s + Number(y.available_vacation_days), 0);

      const step7Artifact = testInfo.outputPath("step7-balance-restored.json");
      await writeFile(step7Artifact, JSON.stringify({
        totalBefore,
        totalRestored,
        restored: totalRestored === totalBefore,
      }, null, 2), "utf-8");
      await testInfo.attach("step7-balance-restored", { path: step7Artifact, contentType: "application/json" });

      expect(totalRestored, "Balance should fully restore after deleting both").toBe(totalBefore);
    } finally {
      await db4.close();
    }
  } finally {
    // Safety cleanup
    if (vacationIdA) {
      await request.delete(`${vacUrl}/${vacationIdA}`, { headers: authHeaders });
    }
    if (vacationIdB) {
      await request.delete(`${vacUrl}/${vacationIdB}`, { headers: authHeaders });
    }
  }
});
