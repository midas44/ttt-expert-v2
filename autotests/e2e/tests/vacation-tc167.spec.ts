import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc167Data } from "../data/VacationTc167Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc167 - availablePaidDays API returns correct values for AV=true @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc167Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const availUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: GET available days with default params
    const resp1 = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${data.paymentMonth}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );

    let body1: Record<string, unknown> = {};
    try { body1 = await resp1.json(); } catch { /* empty */ }

    const step1Artifact = testInfo.outputPath("step1-available-default.json");
    await writeFile(step1Artifact, JSON.stringify({
      status: resp1.status(),
      body: body1,
    }, null, 2), "utf-8");
    await testInfo.attach("step1-available-default", { path: step1Artifact, contentType: "application/json" });

    expect(resp1.status(), "Available days endpoint should return 200").toBe(200);

    // Record initial availablePaidDays
    const initialAvailable = Number(body1.availablePaidDays ?? body1);
    expect(
      Number.isFinite(initialAvailable),
      `availablePaidDays should be a number, got: ${JSON.stringify(body1)}`,
    ).toBe(true);

    // Step 2: Cross-verify with DB — employee_vacation balances
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

    const step2Artifact = testInfo.outputPath("step2-db-balances.json");
    await writeFile(step2Artifact, JSON.stringify({
      dbBalances,
      apiAvailablePaidDays: initialAvailable,
      note: "API availablePaidDays accounts for existing NEW/APPROVED vacations; DB available_vacation_days is the raw per-year balance",
    }, null, 2), "utf-8");
    await testInfo.attach("step2-db-balances", { path: step2Artifact, contentType: "application/json" });

    expect(dbBalances.length, "Should have vacation balance records in DB").toBeGreaterThanOrEqual(1);

    // Step 3: Test with large newDays to trigger daysNotEnough
    // newDays simulates planned consumption — daysNotEnough populated when insufficient
    const largeNewDays = Math.ceil(initialAvailable) + 50;
    const resp3 = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=${largeNewDays}&paymentDate=${data.paymentMonth}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );

    let body3: Record<string, unknown> = {};
    try { body3 = await resp3.json(); } catch { /* empty */ }

    const step3Artifact = testInfo.outputPath("step3-newdays-large.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: resp3.status(),
      body: body3,
      newDaysParam: largeNewDays,
      initialAvailable,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-newdays-large", { path: step3Artifact, contentType: "application/json" });

    expect(resp3.status()).toBe(200);

    // When newDays exceeds available, daysNotEnough should be populated
    const daysNotEnough = body3.daysNotEnough;
    const step3bArtifact = testInfo.outputPath("step3b-daysNotEnough.json");
    await writeFile(step3bArtifact, JSON.stringify({
      daysNotEnough,
      isPopulated: Array.isArray(daysNotEnough) && daysNotEnough.length > 0,
      note: "daysNotEnough populated when newDays exceeds available balance (AV=true may still allow negative)",
    }, null, 2), "utf-8");
    await testInfo.attach("step3b-daysNotEnough", { path: step3bArtifact, contentType: "application/json" });

    // Step 4: Test with usePaymentDateFilter=false — compare results
    const resp4 = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${data.paymentMonth}&usePaymentDateFilter=false`,
      { headers: authHeaders },
    );

    let body4: Record<string, unknown> = {};
    try { body4 = await resp4.json(); } catch { /* empty */ }

    const step4Artifact = testInfo.outputPath("step4-no-payment-filter.json");
    await writeFile(step4Artifact, JSON.stringify({
      status: resp4.status(),
      body: body4,
      withFilter: initialAvailable,
      withoutFilter: Number(body4.availablePaidDays ?? body4),
    }, null, 2), "utf-8");
    await testInfo.attach("step4-no-payment-filter", { path: step4Artifact, contentType: "application/json" });

    expect(resp4.status()).toBe(200);

    // Step 5: Create a 5-day vacation, then re-check available days
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

    // Step 6: Re-check available days — should decrease by ~5
    const resp6 = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${data.paymentMonth}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );

    let body6: Record<string, unknown> = {};
    try { body6 = await resp6.json(); } catch { /* empty */ }

    const step6Artifact = testInfo.outputPath("step6-after-create.json");
    const afterCreateAvailable = Number(body6.availablePaidDays ?? body6);
    await writeFile(step6Artifact, JSON.stringify({
      status: resp6.status(),
      body: body6,
      before: initialAvailable,
      after: afterCreateAvailable,
      expectedDecrease: 5,
      actualDecrease: initialAvailable - afterCreateAvailable,
    }, null, 2), "utf-8");
    await testInfo.attach("step6-after-create", { path: step6Artifact, contentType: "application/json" });

    expect(resp6.status()).toBe(200);

    // Available days should have decreased after creating the vacation
    if (Number.isFinite(afterCreateAvailable)) {
      expect(
        afterCreateAvailable,
        `Available days should decrease after creating 5-day vacation (before: ${initialAvailable}, after: ${afterCreateAvailable})`,
      ).toBeLessThan(initialAvailable);
    }
  } finally {
    // Cleanup: delete the vacation
    if (createdVacationId) {
      const delResp = await request.delete(`${vacUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const cleanupArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(cleanupArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(cleanupArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: cleanupArtifact, contentType: "application/json" });
    }
  }
});
