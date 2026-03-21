import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc137Data } from "../data/VacationTc137Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc137 - AV=true multi-year accumulated balance with FIFO verification @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc137Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const yearsUrl = tttConfig.buildUrl(`${data.vacationDaysEndpoint}/${data.login}/years`);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: DB — Get all employee_vacation rows and employee ID
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

      const step1Artifact = testInfo.outputPath("step1-db-years-before.json");
      await writeFile(step1Artifact, JSON.stringify({
        employeeId,
        login: data.login,
        years: dbYearsBefore,
        totalBalance: dbYearsBefore.reduce((s, y) => s + Number(y.available_vacation_days), 0),
        note: "Baseline: all year balances before vacation creation",
      }, null, 2), "utf-8");
      await testInfo.attach("step1-db-years-before", { path: step1Artifact, contentType: "application/json" });
    } finally {
      await db1.close();
    }

    const nonZeroYears = dbYearsBefore.filter(y => Number(y.available_vacation_days) > 0);
    expect(nonZeroYears.length, "Should have at least 2 years with positive balance").toBeGreaterThanOrEqual(2);

    // Step 2: API — GET per-year breakdown before
    const yearsResp = await request.get(yearsUrl, { headers: authHeaders });
    const yearsBody = await yearsResp.json();

    const step2Artifact = testInfo.outputPath("step2-api-years-before.json");
    await writeFile(step2Artifact, JSON.stringify({
      status: yearsResp.status(),
      years: yearsBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-api-years-before", { path: step2Artifact, contentType: "application/json" });

    expect(yearsResp.status()).toBe(200);
    const apiYearsBefore = Array.isArray(yearsBody) ? yearsBody : [];

    // Step 3: Create 5-day vacation
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });
    const createBody = await createResp.json();

    const step3Artifact = testInfo.outputPath("step3-create-vacation.json");
    await writeFile(step3Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step3-create-vacation", { path: step3Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    const regularDays = Number(createBody.vacation?.regularDays ?? 0);

    // Step 4: DB — Check vacation_days_distribution for FIFO consumption
    const db2 = new DbClient(tttConfig);
    try {
      const distribution = await db2.query<{
        vacation: number;
        year: number;
        days: number;
      }>(
        `SELECT vdd.vacation, vdd.year, vdd.days
         FROM ttt_vacation.vacation_days_distribution vdd
         WHERE vdd.vacation = $1
         ORDER BY vdd.year`,
        [createdVacationId],
      );

      const step4Artifact = testInfo.outputPath("step4-fifo-distribution.json");
      await writeFile(step4Artifact, JSON.stringify({
        vacationId: createdVacationId,
        regularDays,
        distribution,
        distributionTotal: distribution.reduce((s, d) => s + Number(d.days), 0),
        earliestYearConsumed: distribution.length > 0 ? distribution[0].year : null,
        earliestNonZeroYear: nonZeroYears.length > 0 ? nonZeroYears[0].year : null,
        isFIFO: distribution.length > 0 && nonZeroYears.length > 0
          ? distribution[0].year === nonZeroYears[0].year
          : "unknown",
        note: "FIFO: days should be consumed from earliest year with positive balance first",
      }, null, 2), "utf-8");
      await testInfo.attach("step4-fifo-distribution", { path: step4Artifact, contentType: "application/json" });

      expect(distribution.length, "Should have distribution records").toBeGreaterThan(0);

      // Verify distribution total matches regularDays
      const distTotal = distribution.reduce((s, d) => s + Number(d.days), 0);
      expect(distTotal, "Distribution total should match regularDays").toBe(regularDays);

      // Verify FIFO: earliest distribution year should be the earliest year with balance
      if (nonZeroYears.length > 0 && distribution.length > 0) {
        expect(
          distribution[0].year,
          "FIFO: days should be consumed from earliest positive-balance year",
        ).toBe(nonZeroYears[0].year);
      }
    } finally {
      await db2.close();
    }

    // Step 5: API — Verify per-year balances changed after creation
    const yearsResp2 = await request.get(yearsUrl, { headers: authHeaders });
    const yearsBody2 = await yearsResp2.json();
    const apiYearsAfter = Array.isArray(yearsBody2) ? yearsBody2 : [];

    const step5Artifact = testInfo.outputPath("step5-api-years-after.json");
    await writeFile(step5Artifact, JSON.stringify({
      before: apiYearsBefore,
      after: apiYearsAfter,
      note: "Per-year balances should change after vacation creation (earliest year reduced)",
    }, null, 2), "utf-8");
    await testInfo.attach("step5-api-years-after", { path: step5Artifact, contentType: "application/json" });

    // Total days across years should decrease by regularDays
    const totalBefore = apiYearsBefore.reduce(
      (s: number, y: Record<string, unknown>) => s + Number(y.days ?? 0), 0,
    );
    const totalAfter = apiYearsAfter.reduce(
      (s: number, y: Record<string, unknown>) => s + Number(y.days ?? 0), 0,
    );

    expect(
      totalBefore - totalAfter,
      "Total balance decrease should match regularDays consumed",
    ).toBe(regularDays);

    // Step 6: Delete and verify balances restore
    await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    createdVacationId = null;

    const yearsResp3 = await request.get(yearsUrl, { headers: authHeaders });
    const yearsBody3 = await yearsResp3.json();
    const apiYearsRestored = Array.isArray(yearsBody3) ? yearsBody3 : [];

    const totalRestored = apiYearsRestored.reduce(
      (s: number, y: Record<string, unknown>) => s + Number(y.days ?? 0), 0,
    );

    const step6Artifact = testInfo.outputPath("step6-balance-restored.json");
    await writeFile(step6Artifact, JSON.stringify({
      totalBefore,
      totalAfter,
      totalRestored,
      restored: totalRestored === totalBefore,
      note: "Balance should fully restore after deletion",
    }, null, 2), "utf-8");
    await testInfo.attach("step6-balance-restored", { path: step6Artifact, contentType: "application/json" });

    expect(totalRestored, "Balance should restore to original after deletion").toBe(totalBefore);
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});
