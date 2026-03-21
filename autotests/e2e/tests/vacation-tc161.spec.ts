import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc161Data } from "../data/VacationTc161Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc161 - AV=true availablePaidDays after cross-year vacation @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc161Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const summaryUrl = tttConfig.buildUrl(`${data.vacationDaysEndpoint}/${data.login}`);
  const availUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Baseline — GET /vacationdays/{login} summary
    const summaryResp = await request.get(summaryUrl, { headers: authHeaders });
    let summaryBody: Record<string, unknown> = {};
    try { summaryBody = await summaryResp.json(); } catch { /* empty */ }

    const step1Artifact = testInfo.outputPath("step1-summary-baseline.json");
    await writeFile(step1Artifact, JSON.stringify({
      status: summaryResp.status(),
      body: summaryBody,
      fields: {
        currentYear: summaryBody.currentYear ?? summaryBody.currentYearDays,
        pastYearDays: summaryBody.pastYearDays,
        availableDays: summaryBody.availableDays,
      },
    }, null, 2), "utf-8");
    await testInfo.attach("step1-summary-baseline", { path: step1Artifact, contentType: "application/json" });

    expect(summaryResp.status()).toBe(200);

    // Step 2: Baseline — GET /vacationdays/available
    const paymentDate = data.paymentMonth;
    const availResp = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${paymentDate}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );
    let availBody: Record<string, unknown> = {};
    try { availBody = await availResp.json(); } catch { /* empty */ }

    const step2Artifact = testInfo.outputPath("step2-available-baseline.json");
    await writeFile(step2Artifact, JSON.stringify({
      status: availResp.status(),
      body: availBody,
      availablePaidDays: availBody.availablePaidDays,
      currentYear: availBody.currentYear,
      note: "Pre-fix bug: UI showed currentYear instead of availablePaidDays",
    }, null, 2), "utf-8");
    await testInfo.attach("step2-available-baseline", { path: step2Artifact, contentType: "application/json" });

    expect(availResp.status()).toBe(200);
    const baselineAvailPaidDays = Number(availBody.availablePaidDays ?? 0);
    expect(baselineAvailPaidDays, "Baseline availablePaidDays should be > 0").toBeGreaterThan(0);

    // Step 3: Create cross-year vacation (Dec→Jan)
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });
    const createBody = await createResp.json();

    const step3Artifact = testInfo.outputPath("step3-create-cross-year.json");
    await writeFile(step3Artifact, JSON.stringify({
      request: data.buildCreateBody(),
      status: createResp.status(),
      body: createBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-create-cross-year", { path: step3Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create cross-year vacation should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    const regularDays = Number(createBody.vacation?.regularDays ?? 0);
    expect(regularDays, "Cross-year vacation should have regularDays > 0").toBeGreaterThan(0);

    // Step 4: Check vacation_days_distribution — verify cross-year distribution
    const db1 = new DbClient(tttConfig);
    try {
      const distribution = await db1.query<{
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

      const step4Artifact = testInfo.outputPath("step4-cross-year-distribution.json");
      await writeFile(step4Artifact, JSON.stringify({
        vacationId: createdVacationId,
        regularDays,
        distribution,
        yearSpan: distribution.map(d => d.year),
        note: "Cross-year vacation should consume days from FIFO across year boundaries",
      }, null, 2), "utf-8");
      await testInfo.attach("step4-cross-year-distribution", { path: step4Artifact, contentType: "application/json" });

      expect(distribution.length, "Should have distribution records").toBeGreaterThan(0);
    } finally {
      await db1.close();
    }

    // Step 5: Re-check availablePaidDays — should decrease
    const availResp2 = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${paymentDate}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );
    let availBody2: Record<string, unknown> = {};
    try { availBody2 = await availResp2.json(); } catch { /* empty */ }

    const afterAvailPaidDays = Number(availBody2.availablePaidDays ?? 0);
    const afterCurrentYear = Number(availBody2.currentYear ?? 0);

    const step5Artifact = testInfo.outputPath("step5-available-after-create.json");
    await writeFile(step5Artifact, JSON.stringify({
      baselineAvailPaidDays,
      afterAvailPaidDays,
      afterCurrentYear,
      decrease: baselineAvailPaidDays - afterAvailPaidDays,
      regularDays,
      availPaidDaysMatchesCurrentYear: afterAvailPaidDays === afterCurrentYear,
      note: "MR !5169 fix: UI should show availablePaidDays, not currentYear. " +
        "After cross-year vacation these values may differ.",
    }, null, 2), "utf-8");
    await testInfo.attach("step5-available-after-create", { path: step5Artifact, contentType: "application/json" });

    expect(
      afterAvailPaidDays,
      "availablePaidDays should decrease after cross-year vacation",
    ).toBeLessThan(baselineAvailPaidDays);

    // Step 6: Delete and verify restore
    await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    createdVacationId = null;

    const availResp3 = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${paymentDate}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );
    let availBody3: Record<string, unknown> = {};
    try { availBody3 = await availResp3.json(); } catch { /* empty */ }

    const restoredAvailPaidDays = Number(availBody3.availablePaidDays ?? 0);

    const step6Artifact = testInfo.outputPath("step6-available-restored.json");
    await writeFile(step6Artifact, JSON.stringify({
      baselineAvailPaidDays,
      restoredAvailPaidDays,
      restored: restoredAvailPaidDays === baselineAvailPaidDays,
    }, null, 2), "utf-8");
    await testInfo.attach("step6-available-restored", { path: step6Artifact, contentType: "application/json" });

    expect(
      restoredAvailPaidDays,
      "availablePaidDays should restore after deletion",
    ).toBe(baselineAvailPaidDays);
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});
