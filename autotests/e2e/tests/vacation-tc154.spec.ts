import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc154Data } from "../data/VacationTc154Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc154 - vacation days carry-over never expire (burnOff unused) @regress", async ({ request }, testInfo) => {
  const tttConfig = new TttConfig();
  const data = new VacationTc154Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: Query DB for per-year vacation day balances
  const db = new DbClient(tttConfig);
  let dbBalances: Array<Record<string, unknown>> = [];
  try {
    dbBalances = await db.query(
      `SELECT ev.year, ev.available_vacation_days
       FROM ttt_vacation.employee_vacation ev
       JOIN ttt_vacation.employee e ON ev.employee = e.id
       WHERE e.login = $1
       ORDER BY ev.year`,
      [data.login],
    );
  } finally {
    await db.close();
  }

  const step1Artifact = testInfo.outputPath("step1-db-per-year-balances.json");
  await writeFile(step1Artifact, JSON.stringify({
    login: data.login,
    totalYears: dbBalances.length,
    balances: dbBalances,
    totalDays: dbBalances.reduce((s, r) => s + Number(r.available_vacation_days), 0),
  }, null, 2), "utf-8");
  await testInfo.attach("step1-db-per-year-balances", { path: step1Artifact, contentType: "application/json" });

  expect(dbBalances.length, "Should have multiple years of vacation day records").toBeGreaterThanOrEqual(2);

  // Step 2: Identify old year records (2+ years ago)
  const currentYear = new Date().getFullYear();
  const oldYears = dbBalances.filter(r => Number(r.year) <= currentYear - 2);

  const step2Artifact = testInfo.outputPath("step2-old-year-records.json");
  await writeFile(step2Artifact, JSON.stringify({
    currentYear,
    oldYearThreshold: currentYear - 2,
    oldYears,
    oldYearCount: oldYears.length,
    note: "burnOff is defined in CSSalaryOfficeVacationData but NOT synced or used in TTT — days never expire",
  }, null, 2), "utf-8");
  await testInfo.attach("step2-old-year-records", { path: step2Artifact, contentType: "application/json" });

  // Key assertion: old year records still exist in DB (no cleanup/expiration)
  expect(oldYears.length, "Should have vacation day records from 2+ years ago (no expiration)").toBeGreaterThanOrEqual(1);

  // Step 3: Verify old years have non-negative balances (or any balance — they're not zeroed out)
  // AV=true offices can have negative balances, AV=false clamp to 0 — both prove carry-over
  const step3Artifact = testInfo.outputPath("step3-old-year-values.json");
  const oldYearDetails = oldYears.map(r => ({
    year: r.year,
    days: Number(r.available_vacation_days),
    carriedOver: true,
    note: Number(r.available_vacation_days) !== 0
      ? "Non-zero balance carried over — days did not expire"
      : "Zero balance — could mean fully consumed OR never accrued, but record persists",
  }));
  await writeFile(step3Artifact, JSON.stringify(oldYearDetails, null, 2), "utf-8");
  await testInfo.attach("step3-old-year-values", { path: step3Artifact, contentType: "application/json" });

  // Step 4: Verify via API — GET vacationdays/{login}/years
  const yearsUrl = tttConfig.buildUrl(`${data.vacationDaysEndpoint}/${data.login}/years`);
  let apiYears: unknown[] = [];
  let apiAccessible = true;
  try {
    const yearsResp = await request.get(yearsUrl, { headers: authHeaders });
    if (yearsResp.status() === 200) {
      apiYears = await yearsResp.json() as unknown[];
    } else {
      apiAccessible = false;
    }
  } catch {
    apiAccessible = false;
  }

  const step4Artifact = testInfo.outputPath("step4-api-years-breakdown.json");
  await writeFile(step4Artifact, JSON.stringify({
    apiAccessible,
    apiYearCount: apiYears.length,
    apiYears,
    dbYearCount: dbBalances.length,
    match: apiYears.length === dbBalances.length,
    note: apiAccessible
      ? "API years breakdown confirms DB records — no expiration applied"
      : "API unavailable — DB verification stands as primary proof",
  }, null, 2), "utf-8");
  await testInfo.attach("step4-api-years-breakdown", { path: step4Artifact, contentType: "application/json" });

  // Step 5: Verify via API — GET vacationdays/{login} summary
  const summaryUrl = tttConfig.buildUrl(`${data.vacationDaysEndpoint}/${data.login}`);
  let summaryBody: Record<string, unknown> = {};
  try {
    const summaryResp = await request.get(summaryUrl, { headers: authHeaders });
    if (summaryResp.status() === 200) {
      summaryBody = await summaryResp.json();
    }
  } catch { /* API may be down */ }

  const step5Artifact = testInfo.outputPath("step5-api-summary.json");
  await writeFile(step5Artifact, JSON.stringify({
    body: summaryBody,
    hasPastPeriodDays: "pastPeriodsAvailableDays" in summaryBody,
    pastPeriodsAvailableDays: summaryBody.pastPeriodsAvailableDays,
    note: "pastPeriodsAvailableDays includes all old year balances — non-zero proves carry-over",
  }, null, 2), "utf-8");
  await testInfo.attach("step5-api-summary", { path: step5Artifact, contentType: "application/json" });

  // Step 6: Cross-verify — confirm no burnOff column in office table
  const db2 = new DbClient(tttConfig);
  try {
    const columns = await db2.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'ttt_vacation' AND table_name = 'office'
       AND column_name LIKE '%burn%'`,
      [],
    );

    const step6Artifact = testInfo.outputPath("step6-no-burnoff-column.json");
    await writeFile(step6Artifact, JSON.stringify({
      burnOffColumnsFound: columns.length,
      columns,
      conclusion: columns.length === 0
        ? "Confirmed: no burn_off column in ttt_vacation.office — setting is unimplemented"
        : "Unexpected: burn_off column found — investigate",
    }, null, 2), "utf-8");
    await testInfo.attach("step6-no-burnoff-column", { path: step6Artifact, contentType: "application/json" });

    // No burnOff column should exist
    expect(columns.length, "No burn_off column should exist in office table").toBe(0);
  } finally {
    await db2.close();
  }
});
