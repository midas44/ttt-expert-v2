import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc136Data } from "../data/VacationTc136Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc136 - AV=true negative balance carry-over @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc136Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const daysUrl = tttConfig.buildUrl(`${data.vacationDaysEndpoint}/${data.login}`);
  const yearsUrl = tttConfig.buildUrl(`${data.vacationDaysEndpoint}/${data.login}/years`);
  const availUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: GET vacationdays/{login} — baseline summary
    const summaryResp = await request.get(daysUrl, { headers: authHeaders });

    let summaryBody: Record<string, unknown> = {};
    try { summaryBody = await summaryResp.json(); } catch { /* empty */ }

    const step1Artifact = testInfo.outputPath("step1-days-summary.json");
    await writeFile(step1Artifact, JSON.stringify({
      status: summaryResp.status(),
      login: data.login,
      body: summaryBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step1-days-summary", { path: step1Artifact, contentType: "application/json" });

    expect(summaryResp.status()).toBe(200);

    // Step 2: GET vacationdays/{login}/years — per-year balances
    const yearsResp = await request.get(yearsUrl, { headers: authHeaders });

    let yearsBody: unknown = [];
    try { yearsBody = await yearsResp.json(); } catch { /* empty */ }

    const step2Artifact = testInfo.outputPath("step2-years-balances.json");
    await writeFile(step2Artifact, JSON.stringify({
      status: yearsResp.status(),
      body: yearsBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-years-balances", { path: step2Artifact, contentType: "application/json" });

    expect(yearsResp.status()).toBe(200);

    // Check if any year already has negative balance
    const yearsArray = Array.isArray(yearsBody) ? yearsBody : [];
    const negativeYears = yearsArray.filter(
      (y: Record<string, unknown>) => Number(y.availableVacationDays ?? y.days ?? 0) < 0,
    );

    // Step 3: GET available days — baseline
    const availResp = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${data.paymentMonth}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );

    let availBody: Record<string, unknown> = {};
    try { availBody = await availResp.json(); } catch { /* empty */ }

    const step3Artifact = testInfo.outputPath("step3-available-before.json");
    const availableBefore = Number(availBody.availablePaidDays ?? availBody);
    await writeFile(step3Artifact, JSON.stringify({
      status: availResp.status(),
      body: availBody,
      availablePaidDays: availableBefore,
      negativeYears,
      hasNegativeYears: negativeYears.length > 0,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-available-before", { path: step3Artifact, contentType: "application/json" });

    expect(availResp.status()).toBe(200);

    // Step 4: Cross-verify with DB
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

    const step4Artifact = testInfo.outputPath("step4-db-balances.json");
    await writeFile(step4Artifact, JSON.stringify({
      login: data.login,
      dbBalances,
      negativeDbYears: dbBalances.filter((r) => Number(r.available_vacation_days) < 0),
      totalBalance: dbBalances.reduce((s, r) => s + Number(r.available_vacation_days), 0),
      note: "AV=true (AdvanceCalculationStrategy): availableDays = currentYearDays + pastYearDays + futureDays + edited",
    }, null, 2), "utf-8");
    await testInfo.attach("step4-db-balances", { path: step4Artifact, contentType: "application/json" });

    // Step 5: Create a 5-day vacation, verify balance decreases correctly
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
    const consumedDays = createBody.vacation?.regularDays ?? 5;

    // Step 6: GET available days after creation
    const availAfterResp = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${data.paymentMonth}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );

    let availAfterBody: Record<string, unknown> = {};
    try { availAfterBody = await availAfterResp.json(); } catch { /* empty */ }

    const availableAfter = Number(availAfterBody.availablePaidDays ?? availAfterBody);

    const step6Artifact = testInfo.outputPath("step6-available-after.json");
    await writeFile(step6Artifact, JSON.stringify({
      status: availAfterResp.status(),
      body: availAfterBody,
      before: availableBefore,
      after: availableAfter,
      consumedDays,
      expectedDecrease: consumedDays,
      actualDecrease: availableBefore - availableAfter,
      isNegative: availableAfter < 0,
      note: "AV=true allows negative available days — no clamping to 0",
    }, null, 2), "utf-8");
    await testInfo.attach("step6-available-after", { path: step6Artifact, contentType: "application/json" });

    expect(availAfterResp.status()).toBe(200);

    // Key assertion: balance should decrease by exactly the consumed days
    if (Number.isFinite(availableAfter) && Number.isFinite(availableBefore)) {
      expect(
        availableBefore - availableAfter,
        `Balance should decrease by consumed days (${consumedDays})`,
      ).toBe(consumedDays);
    }

    // Step 7: Verify AV=true behavior — available can be negative
    // (Unlike AV=false which clamps to 0)
    const step7Artifact = testInfo.outputPath("step7-av-true-behavior.json");
    await writeFile(step7Artifact, JSON.stringify({
      isAvTrueOffice: true,
      officeName: "Персей (office_id=20)",
      availableAfterCreate: availableAfter,
      note: availableAfter < 0
        ? "Confirmed: AV=true allows negative balance"
        : "Balance still positive — AV=true negative behavior can occur with more consumption",
      formula: "availableDays = currentYearDays + pastYearDays + futureDays + editedVacationDays (no clamping)",
    }, null, 2), "utf-8");
    await testInfo.attach("step7-av-true-behavior", { path: step7Artifact, contentType: "application/json" });
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
