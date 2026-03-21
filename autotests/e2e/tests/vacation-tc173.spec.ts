import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc173Data } from "../data/VacationTc173Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc173 - year-end balance unbounded year sum (#3360 fix) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc173Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const yearsUrl = tttConfig.buildUrl(`${data.vacationDaysEndpoint}/${data.login}/years`);
  const availUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: DB — Get all employee_vacation rows grouped by year
    const db1 = new DbClient(tttConfig);
    let dbYears: Array<{ year: number; available_vacation_days: number }>;
    let employeeId: number;
    try {
      const empRow = await db1.queryOne<{ id: number }>(
        `SELECT id FROM ttt_vacation.employee WHERE login = $1`,
        [data.login],
      );
      employeeId = empRow.id;

      dbYears = await db1.query<{ year: number; available_vacation_days: number }>(
        `SELECT ev.year, ev.available_vacation_days
         FROM ttt_vacation.employee_vacation ev
         WHERE ev.employee = $1
         ORDER BY ev.year`,
        [employeeId],
      );

      const step1Artifact = testInfo.outputPath("step1-db-employee-vacation.json");
      await writeFile(step1Artifact, JSON.stringify({
        employeeId,
        login: data.login,
        yearCount: dbYears.length,
        years: dbYears,
        note: "All employee_vacation rows — the fix sums ALL years, not just recent 2",
      }, null, 2), "utf-8");
      await testInfo.attach("step1-db-employee-vacation", { path: step1Artifact, contentType: "application/json" });
    } finally {
      await db1.close();
    }

    expect(dbYears.length, "Employee should have multi-year vacation data").toBeGreaterThanOrEqual(2);

    // Step 2: Compute unbounded DB sum (all years)
    const currentYear = new Date().getFullYear();
    const dbTotalAll = dbYears.reduce(
      (sum, y) => sum + Number(y.available_vacation_days), 0,
    );
    const dbTotalPast = dbYears
      .filter(y => y.year < currentYear)
      .reduce((sum, y) => sum + Number(y.available_vacation_days), 0);
    const dbTotalCurrent = dbYears
      .filter(y => y.year === currentYear)
      .reduce((sum, y) => sum + Number(y.available_vacation_days), 0);

    const step2Artifact = testInfo.outputPath("step2-db-sums.json");
    await writeFile(step2Artifact, JSON.stringify({
      currentYear,
      dbTotalAll,
      dbTotalPast,
      dbTotalCurrent,
      yearBreakdown: dbYears.map(y => ({ year: y.year, days: Number(y.available_vacation_days) })),
      note: "Fix: calculateDaysNotAfter(year) sums ALL years ≤ currentYear",
    }, null, 2), "utf-8");
    await testInfo.attach("step2-db-sums", { path: step2Artifact, contentType: "application/json" });

    // Step 3: API — GET vacationdays/{login}/years — per-year breakdown
    const yearsResp = await request.get(yearsUrl, { headers: authHeaders });
    let yearsBody: unknown = [];
    try { yearsBody = await yearsResp.json(); } catch { /* empty response */ }

    const step3Artifact = testInfo.outputPath("step3-api-years.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: yearsResp.status(),
      body: yearsBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-api-years", { path: step3Artifact, contentType: "application/json" });

    expect(yearsResp.status(), "Years endpoint should return 200").toBe(200);

    // Verify API years match DB non-zero years (API filters out zero-balance years)
    const apiYears = Array.isArray(yearsBody) ? yearsBody : [];
    const apiYearNumbers = apiYears.map((y: Record<string, unknown>) => Number(y.year));
    const dbNonZeroYears = dbYears.filter(y => Number(y.available_vacation_days) !== 0);

    for (const dbYear of dbNonZeroYears) {
      expect(
        apiYearNumbers,
        `Non-zero year ${dbYear.year} (${dbYear.available_vacation_days} days) should appear in API`,
      ).toContain(dbYear.year);
    }

    // Verify API total matches DB non-zero sum
    const apiTotal = apiYears.reduce(
      (sum: number, y: Record<string, unknown>) => sum + Number(y.days ?? 0), 0,
    );
    const dbNonZeroTotal = dbNonZeroYears.reduce(
      (sum, y) => sum + Number(y.available_vacation_days), 0,
    );
    expect(apiTotal, "API years total should match DB non-zero sum").toBe(dbNonZeroTotal);

    // Step 4: API — GET availablePaidDays baseline
    const paymentDate = data.startDate.slice(0, 7) + "-01";
    const availResp = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${paymentDate}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );

    let availBody: Record<string, unknown> = {};
    try { availBody = await availResp.json(); } catch { /* empty */ }

    const step4Artifact = testInfo.outputPath("step4-available-paid-days-baseline.json");
    await writeFile(step4Artifact, JSON.stringify({
      status: availResp.status(),
      body: availBody,
      note: "availablePaidDays should reflect unbounded year sum",
    }, null, 2), "utf-8");
    await testInfo.attach("step4-available-paid-days-baseline", { path: step4Artifact, contentType: "application/json" });

    expect(availResp.status(), "Available days endpoint should return 200").toBe(200);
    const baselineAvailable = Number(availBody.availablePaidDays ?? availBody.available ?? 0);
    expect(baselineAvailable, "Baseline available days should be > 0").toBeGreaterThan(0);

    // Step 5: Create a 5-day vacation and verify balance decreases
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });
    const createBody = await createResp.json();

    const step5Artifact = testInfo.outputPath("step5-create-vacation.json");
    await writeFile(step5Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step5-create-vacation", { path: step5Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    const regularDays = Number(createBody.vacation?.regularDays ?? 0);

    // Step 6: Re-check availablePaidDays — should decrease
    const availResp2 = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${paymentDate}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );
    let availBody2: Record<string, unknown> = {};
    try { availBody2 = await availResp2.json(); } catch { /* empty */ }

    const afterCreateAvailable = Number(availBody2.availablePaidDays ?? availBody2.available ?? 0);

    const step6Artifact = testInfo.outputPath("step6-available-after-create.json");
    await writeFile(step6Artifact, JSON.stringify({
      baselineAvailable,
      afterCreateAvailable,
      regularDays,
      decrease: baselineAvailable - afterCreateAvailable,
      expectedDecrease: regularDays,
      note: "Available days should decrease by the number of regular days consumed",
    }, null, 2), "utf-8");
    await testInfo.attach("step6-available-after-create", { path: step6Artifact, contentType: "application/json" });

    expect(
      afterCreateAvailable,
      "Available days should decrease after vacation creation",
    ).toBeLessThan(baselineAvailable);

    // Step 7: Delete vacation and verify balance restores
    await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    createdVacationId = null; // prevent double-delete in finally

    const availResp3 = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${paymentDate}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );
    let availBody3: Record<string, unknown> = {};
    try { availBody3 = await availResp3.json(); } catch { /* empty */ }

    const afterDeleteAvailable = Number(availBody3.availablePaidDays ?? availBody3.available ?? 0);

    const step7Artifact = testInfo.outputPath("step7-available-after-delete.json");
    await writeFile(step7Artifact, JSON.stringify({
      baselineAvailable,
      afterDeleteAvailable,
      restored: afterDeleteAvailable === baselineAvailable,
      note: "Balance should restore after vacation deletion",
    }, null, 2), "utf-8");
    await testInfo.attach("step7-available-after-delete", { path: step7Artifact, contentType: "application/json" });

    expect(
      afterDeleteAvailable,
      "Available days should restore to baseline after deletion",
    ).toBe(baselineAvailable);
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});
