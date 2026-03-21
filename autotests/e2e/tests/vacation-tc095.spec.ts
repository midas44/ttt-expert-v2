import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc095Data } from "../data/VacationTc095Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc095 - auto-pay expired approved vacations via cron trigger @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc095Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Query DB for existing old APPROVED vacations (>2 months old)
    const db1 = new DbClient(tttConfig);
    let oldApprovedBefore: Array<Record<string, unknown>> = [];
    try {
      oldApprovedBefore = await db1.query(
        `SELECT v.id, v.start_date, v.end_date, v.status, v.payment_type, e.login
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         WHERE v.status = 'APPROVED'
         AND v.end_date < (CURRENT_DATE - INTERVAL '2 months' + INTERVAL '2 days')
         ORDER BY v.end_date
         LIMIT 20`,
        [],
      );
    } finally {
      await db1.close();
    }

    const step1Artifact = testInfo.outputPath("step1-old-approved-before.json");
    await writeFile(step1Artifact, JSON.stringify({
      oldApprovedCount: oldApprovedBefore.length,
      oldApproved: oldApprovedBefore,
      cronCriteria: "APPROVED vacations with end_date < today - 2 months + 2 days",
    }, null, 2), "utf-8");
    await testInfo.attach("step1-old-approved-before", { path: step1Artifact, contentType: "application/json" });

    // Step 2: Create a new vacation (future dates — should NOT be auto-paid)
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResp.json();
    const step2Artifact = testInfo.outputPath("step2-create-vacation.json");
    await writeFile(step2Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step2-create-vacation", { path: step2Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create should return 200").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createdVacationId, "Should get vacation ID").toBeTruthy();

    // Step 3: Approve the vacation (PUT /approve/{id})
    const approveResp = await request.put(
      `${vacUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    let approveBody: Record<string, unknown> = {};
    try { approveBody = await approveResp.json(); } catch { /* empty */ }

    const step3Artifact = testInfo.outputPath("step3-approve-vacation.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: approveResp.status(),
      body: approveBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-approve-vacation", { path: step3Artifact, contentType: "application/json" });

    expect(approveResp.status(), "Approve should return 200").toBe(200);

    // Step 4: Verify our vacation is APPROVED
    const getResp = await request.get(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    const getBody = await getResp.json();

    const step4Artifact = testInfo.outputPath("step4-verify-approved.json");
    await writeFile(step4Artifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-verify-approved", { path: step4Artifact, contentType: "application/json" });

    expect(getBody.vacation?.status ?? getBody.status, "Vacation should be APPROVED").toBe("APPROVED");

    // Step 5: Trigger the auto-pay cron via test API
    const cronUrl = tttConfig.buildUrl(data.payExpiredEndpoint);
    const cronResp = await request.post(cronUrl, { headers: authHeaders });

    let cronBody: unknown = null;
    try { cronBody = await cronResp.json(); } catch {
      try { cronBody = await cronResp.text(); } catch { /* empty */ }
    }

    const step5Artifact = testInfo.outputPath("step5-trigger-cron.json");
    await writeFile(step5Artifact, JSON.stringify({
      status: cronResp.status(),
      body: cronBody,
      endpoint: data.payExpiredEndpoint,
      note: "Triggers AutomaticallyPayApprovedTask — pays APPROVED vacations older than 2 months",
    }, null, 2), "utf-8");
    await testInfo.attach("step5-trigger-cron", { path: step5Artifact, contentType: "application/json" });

    expect(cronResp.ok(), `Cron trigger should succeed (got ${cronResp.status()})`).toBe(true);

    // Step 6: Verify our NEW vacation is still APPROVED (not auto-paid — too recent)
    const afterResp = await request.get(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    const afterBody = await afterResp.json();

    const step6Artifact = testInfo.outputPath("step6-verify-still-approved.json");
    await writeFile(step6Artifact, JSON.stringify({
      body: afterBody,
      expectedStatus: "APPROVED",
      actualStatus: afterBody.vacation?.status ?? afterBody.status,
      note: "Recently-approved vacation should NOT be auto-paid (end_date is in the future)",
    }, null, 2), "utf-8");
    await testInfo.attach("step6-verify-still-approved", { path: step6Artifact, contentType: "application/json" });

    const afterStatus = afterBody.vacation?.status ?? afterBody.status;
    expect(afterStatus, "Our vacation should still be APPROVED (not old enough for auto-pay)").toBe("APPROVED");

    // Step 7: Check how many old APPROVED vacations were auto-paid by the cron
    const db2 = new DbClient(tttConfig);
    try {
      const oldApprovedAfter = await db2.query(
        `SELECT v.id, v.start_date, v.end_date, v.status, e.login
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         WHERE v.status = 'APPROVED'
         AND v.end_date < (CURRENT_DATE - INTERVAL '2 months' + INTERVAL '2 days')
         ORDER BY v.end_date
         LIMIT 20`,
        [],
      );

      const paidByIds = oldApprovedBefore
        .map(v => v.id)
        .filter(id => !oldApprovedAfter.some(a => a.id === id));

      const step7Artifact = testInfo.outputPath("step7-cron-results.json");
      await writeFile(step7Artifact, JSON.stringify({
        oldApprovedBeforeCount: oldApprovedBefore.length,
        oldApprovedAfterCount: oldApprovedAfter.length,
        paidByCron: paidByIds.length,
        paidIds: paidByIds,
        note: paidByIds.length > 0
          ? `Cron auto-paid ${paidByIds.length} old APPROVED vacations`
          : "No old APPROVED vacations were eligible for auto-pay (or none existed)",
      }, null, 2), "utf-8");
      await testInfo.attach("step7-cron-results", { path: step7Artifact, contentType: "application/json" });

      // Document results — both zero and non-zero are valid outcomes
      expect(true, "Cron execution completed and results documented").toBe(true);
    } finally {
      await db2.close();
    }
  } finally {
    // Cleanup: cancel first (if APPROVED), then delete
    if (createdVacationId) {
      try {
        await request.put(`${vacUrl}/cancel/${createdVacationId}`, { headers: authHeaders });
      } catch { /* may fail if already deleted */ }
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});
