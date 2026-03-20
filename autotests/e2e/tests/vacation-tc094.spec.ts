import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc094Data } from "../data/VacationTc094Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc094 - Payment type alignment bug: admin vacation paid as regular (known bug) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc094Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create ADMINISTRATIVE vacation (1 day)
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create-admin.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-admin", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const createVac = createBody.vacation;
    expect(createVac).toBeTruthy();
    expect(createVac.status).toBe("NEW");
    expect(createVac.paymentType).toBe("ADMINISTRATIVE");
    createdVacationId = createVac.id;

    const adminDays = createVac.administrativeDays;
    expect(adminDays, "ADMINISTRATIVE vacation should have administrativeDays > 0").toBeGreaterThan(0);
    expect(createVac.regularDays, "ADMINISTRATIVE vacation should have regularDays = 0").toBe(0);

    // Step 2: Approve
    const approveResponse = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    const approveBody = await approveResponse.json();
    const approveArtifact = testInfo.outputPath("step2-approve.json");
    await writeFile(approveArtifact, JSON.stringify(approveBody, null, 2), "utf-8");
    await testInfo.attach("step2-approve", { path: approveArtifact, contentType: "application/json" });

    expect(approveResponse.status()).toBe(200);
    const approveVac = approveBody.vacation ?? approveBody;
    expect(approveVac.status).toBe("APPROVED");

    // Step 3: Pay with MISMATCHED type (regular=1, administrative=0 for an ADMINISTRATIVE vacation)
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildMismatchedPayBody(),
      },
    );

    const payBody = await payResponse.json();
    const payArtifact = testInfo.outputPath("step3-pay-mismatched.json");
    await writeFile(payArtifact, JSON.stringify(payBody, null, 2), "utf-8");
    await testInfo.attach("step3-pay-mismatched", { path: payArtifact, contentType: "application/json" });

    // BUG: checkForPayment validates only total == days, not type alignment
    // Expected: HTTP 400 (type mismatch)
    // Actual: HTTP 200 — ADMINISTRATIVE vacation paid as REGULAR
    expect(payResponse.status(), "BUG: Mismatched payment type accepted (200 instead of 400)").toBe(200);

    const payVac = payBody.vacation ?? payBody;
    expect(payVac.status).toBe("PAID");

    // Step 4: Verify DB payment record shows incorrect classification
    const db = new DbClient(tttConfig);
    try {
      const paymentRows = await db.query(
        `SELECT v.vacation_payment_id, vp.regular_days, vp.administrative_days
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.vacation_payment vp ON v.vacation_payment_id = vp.id
         WHERE v.id = $1`,
        [createdVacationId],
      );

      const dbArtifact = testInfo.outputPath("step4-db-payment-mismatch.json");
      await writeFile(dbArtifact, JSON.stringify({
        vacationType: "ADMINISTRATIVE",
        paymentRecord: paymentRows[0] ?? null,
        bug: "ADMINISTRATIVE vacation has regular_days=1, administrative_days=0 in payment",
      }, null, 2), "utf-8");
      await testInfo.attach("step4-db-payment-mismatch", { path: dbArtifact, contentType: "application/json" });

      expect(paymentRows.length).toBeGreaterThanOrEqual(1);
      const payment = paymentRows[0];
      // BUG confirmation: payment record has regular_days=1 for an ADMINISTRATIVE vacation
      expect(payment.regular_days, "BUG: Payment records 1 regular day for ADMINISTRATIVE vacation").toBe(1);
      expect(payment.administrative_days, "BUG: Payment records 0 admin days for ADMINISTRATIVE vacation").toBe(0);
    } finally {
      await db.close();
    }
  } finally {
    // PAID+EXACT cannot be deleted — attempt cleanup only if test failed before PAID
    if (createdVacationId) {
      await request.put(`${baseUrl}/cancel/${createdVacationId}`, {
        headers: authHeaders,
      });
      const delResp = await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const delArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(delArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(delArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: delArtifact, contentType: "application/json" });
    }
  }
});
