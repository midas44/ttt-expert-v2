import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc069Data } from "../data/VacationTc069Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc069 - AV=false basic accrual formula mid-year calculation @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc069Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const daysUrl = tttConfig.buildUrl(`${data.vacationDaysEndpoint}/${data.login}`);
  const availUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET vacationdays/{login} — summary with normForYear
  const summaryResp = await request.get(daysUrl, { headers: authHeaders });

  let summaryBody: Record<string, unknown> = {};
  try { summaryBody = await summaryResp.json(); } catch { /* empty */ }

  const step1Artifact = testInfo.outputPath("step1-vacation-days-summary.json");
  await writeFile(step1Artifact, JSON.stringify({
    status: summaryResp.status(),
    login: data.login,
    body: summaryBody,
  }, null, 2), "utf-8");
  await testInfo.attach("step1-vacation-days-summary", { path: step1Artifact, contentType: "application/json" });

  expect(summaryResp.status(), "vacationdays/{login} should return 200").toBe(200);

  const normForYear = Number(summaryBody.normForYear ?? 0);
  expect(normForYear, "normForYear should be a positive number").toBeGreaterThan(0);

  // Step 2: GET available days for month 3 (March)
  const month3Date = "2026-03-01";
  const resp3 = await request.get(
    `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${month3Date}&usePaymentDateFilter=true`,
    { headers: authHeaders },
  );

  let body3: Record<string, unknown> = {};
  try { body3 = await resp3.json(); } catch { /* empty */ }

  const step2Artifact = testInfo.outputPath("step2-available-month3.json");
  await writeFile(step2Artifact, JSON.stringify({
    status: resp3.status(),
    paymentDate: month3Date,
    body: body3,
  }, null, 2), "utf-8");
  await testInfo.attach("step2-available-month3", { path: step2Artifact, contentType: "application/json" });

  expect(resp3.status()).toBe(200);
  const availableMonth3 = Number(body3.availablePaidDays ?? body3);

  // Step 3: GET available days for month 6 (June)
  const month6Date = "2026-06-01";
  const resp6 = await request.get(
    `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${month6Date}&usePaymentDateFilter=true`,
    { headers: authHeaders },
  );

  let body6: Record<string, unknown> = {};
  try { body6 = await resp6.json(); } catch { /* empty */ }

  const step3Artifact = testInfo.outputPath("step3-available-month6.json");
  await writeFile(step3Artifact, JSON.stringify({
    status: resp6.status(),
    paymentDate: month6Date,
    body: body6,
  }, null, 2), "utf-8");
  await testInfo.attach("step3-available-month6", { path: step3Artifact, contentType: "application/json" });

  expect(resp6.status()).toBe(200);
  const availableMonth6 = Number(body6.availablePaidDays ?? body6);

  // Step 4: GET available days for month 12 (December)
  const month12Date = "2026-12-01";
  const resp12 = await request.get(
    `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${month12Date}&usePaymentDateFilter=true`,
    { headers: authHeaders },
  );

  let body12: Record<string, unknown> = {};
  try { body12 = await resp12.json(); } catch { /* empty */ }

  const step4Artifact = testInfo.outputPath("step4-available-month12.json");
  await writeFile(step4Artifact, JSON.stringify({
    status: resp12.status(),
    paymentDate: month12Date,
    body: body12,
  }, null, 2), "utf-8");
  await testInfo.attach("step4-available-month12", { path: step4Artifact, contentType: "application/json" });

  expect(resp12.status()).toBe(200);
  const availableMonth12 = Number(body12.availablePaidDays ?? body12);

  // Step 5: Verify accrual formula behavior
  // For AV=false: accruedDays = month × (norm / 12)
  // Accrual at month 6 is 3 months more than month 3 → +3×(norm/12) = +norm/4
  const expectedDelta3to6 = 3 * (normForYear / 12);
  const actualDelta3to6 = availableMonth6 - availableMonth3;

  // Accrual at month 12 is 6 months more than month 6 → +6×(norm/12) = +norm/2
  const expectedDelta6to12 = 6 * (normForYear / 12);
  const actualDelta6to12 = availableMonth12 - availableMonth6;

  const step5Artifact = testInfo.outputPath("step5-accrual-verification.json");
  await writeFile(step5Artifact, JSON.stringify({
    normForYear,
    availableMonth3,
    availableMonth6,
    availableMonth12,
    delta3to6: { expected: expectedDelta3to6, actual: actualDelta3to6 },
    delta6to12: { expected: expectedDelta6to12, actual: actualDelta6to12 },
    note: "For AV=false, accrual increases linearly with month: accruedDays = month × (norm/12)",
  }, null, 2), "utf-8");
  await testInfo.attach("step5-accrual-verification", { path: step5Artifact, contentType: "application/json" });

  // Accrual should increase from month 3 → month 6 (more months = more accrued)
  expect(
    actualDelta3to6,
    `Available days should increase from month 3 to month 6 (delta: ${actualDelta3to6}, expected ~${expectedDelta3to6})`,
  ).toBeCloseTo(expectedDelta3to6, 0);

  // Accrual should increase from month 6 → month 12
  expect(
    actualDelta6to12,
    `Available days should increase from month 6 to month 12 (delta: ${actualDelta6to12}, expected ~${expectedDelta6to12})`,
  ).toBeCloseTo(expectedDelta6to12, 0);

  // Step 6: Verify AV=false clamps to 0 (never shows negative)
  // All values should be >= 0
  const step6Artifact = testInfo.outputPath("step6-non-negative.json");
  await writeFile(step6Artifact, JSON.stringify({
    availableMonth3,
    availableMonth6,
    availableMonth12,
    allNonNegative: availableMonth3 >= 0 && availableMonth6 >= 0 && availableMonth12 >= 0,
    note: "AV=false (RegularCalculationStrategy) clamps negative result to 0",
  }, null, 2), "utf-8");
  await testInfo.attach("step6-non-negative", { path: step6Artifact, contentType: "application/json" });

  expect(availableMonth3, "Month 3 available should be >= 0 (AV=false clamp)").toBeGreaterThanOrEqual(0);
  expect(availableMonth6, "Month 6 available should be >= 0 (AV=false clamp)").toBeGreaterThanOrEqual(0);
  expect(availableMonth12, "Month 12 available should be >= 0 (AV=false clamp)").toBeGreaterThanOrEqual(0);

  // Step 7: Cross-verify with DB — employee_vacation balances
  const db = new DbClient(tttConfig);
  try {
    const dbBalances = await db.query(
      `SELECT ev.year, ev.available_vacation_days
       FROM ttt_vacation.employee_vacation ev
       JOIN ttt_vacation.employee e ON ev.employee = e.id
       WHERE e.login = $1
       ORDER BY ev.year`,
      [data.login],
    );

    const step7Artifact = testInfo.outputPath("step7-db-balances.json");
    await writeFile(step7Artifact, JSON.stringify({
      login: data.login,
      dbBalances,
      note: "employee_vacation.available_vacation_days = raw per-year balance pool",
    }, null, 2), "utf-8");
    await testInfo.attach("step7-db-balances", { path: step7Artifact, contentType: "application/json" });

    expect(dbBalances.length, "Should have balance records in DB").toBeGreaterThanOrEqual(1);
  } finally {
    await db.close();
  }
});
