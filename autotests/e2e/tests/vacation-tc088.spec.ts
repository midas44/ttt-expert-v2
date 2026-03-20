import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc088Data } from "../data/VacationTc088Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc088 - Pay APPROVED REGULAR vacation happy path with DB verification @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc088Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create a REGULAR vacation
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const createVac = createBody.vacation;
    expect(createVac).toBeTruthy();
    expect(createVac.status).toBe("NEW");
    createdVacationId = createVac.id;

    const regularDays = createVac.regularDays;
    expect(regularDays).toBeGreaterThan(0);

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

    // Step 3: Pay with correct day split (all regular, 0 administrative)
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildPayBody(regularDays),
      },
    );

    const payBody = await payResponse.json();
    const payArtifact = testInfo.outputPath("step3-pay.json");
    await writeFile(payArtifact, JSON.stringify(payBody, null, 2), "utf-8");
    await testInfo.attach("step3-pay", { path: payArtifact, contentType: "application/json" });

    expect(payResponse.status(), "Pay should return 200").toBe(200);
    const payVac = payBody.vacation ?? payBody;
    expect(payVac.status).toBe("PAID");

    // Step 4: Verify payment record in database
    const db = new DbClient(tttConfig);
    try {
      const paymentRows = await db.query(
        `SELECT v.vacation_payment_id, vp.regular_days, vp.administrative_days, vp.payed_at
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.vacation_payment vp ON v.vacation_payment_id = vp.id
         WHERE v.id = $1`,
        [createdVacationId],
      );

      const dbArtifact = testInfo.outputPath("step4-db-payment.json");
      await writeFile(dbArtifact, JSON.stringify(paymentRows, null, 2), "utf-8");
      await testInfo.attach("step4-db-payment", { path: dbArtifact, contentType: "application/json" });

      expect(paymentRows.length, "vacation_payment record should exist").toBeGreaterThanOrEqual(1);
      const payment = paymentRows[0];
      expect(payment.vacation_payment_id, "vacation should have payment FK").toBeTruthy();
      expect(payment.regular_days).toBe(regularDays);
      expect(payment.administrative_days).toBe(0);
      expect(payment.payed_at, "payed_at should be set").toBeTruthy();
    } finally {
      await db.close();
    }

    // Step 5: GET to confirm API response also shows PAID
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step5-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step5-verify", { path: getArtifact, contentType: "application/json" });

    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("PAID");
  } finally {
    // PAID+EXACT cannot be deleted. Attempt cleanup only if test failed before PAID.
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
