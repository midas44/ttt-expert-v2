import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc103Data } from "../data/VacationTc103Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc103 - DB/API data representation inconsistency for ADMINISTRATIVE vacations (known bug) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc103Data.create(globalConfig.testDataMode, tttConfig);

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
    expect((approveBody.vacation ?? approveBody).status).toBe("APPROVED");

    // Step 3: Pay with correct type alignment (0 regular, 1 admin)
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildPayBody(),
      },
    );

    const payBody = await payResponse.json();
    const payArtifact = testInfo.outputPath("step3-pay.json");
    await writeFile(payArtifact, JSON.stringify(payBody, null, 2), "utf-8");
    await testInfo.attach("step3-pay", { path: payArtifact, contentType: "application/json" });

    expect(payResponse.status()).toBe(200);
    const payVac = payBody.vacation ?? payBody;
    expect(payVac.status).toBe("PAID");

    // Step 4: GET vacation via API — check API representation
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getVac = getBody.vacation ?? getBody;

    const apiArtifact = testInfo.outputPath("step4-api-representation.json");
    await writeFile(apiArtifact, JSON.stringify({
      vacationId: createdVacationId,
      paymentType: getVac.paymentType,
      apiRegularDays: getVac.regularDays,
      apiAdministrativeDays: getVac.administrativeDays,
    }, null, 2), "utf-8");
    await testInfo.attach("step4-api-representation", { path: apiArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    // API shows the "correct" view: regularDays=0, administrativeDays=1
    expect(getVac.paymentType).toBe("ADMINISTRATIVE");
    expect(getVac.regularDays, "API shows regularDays=0 for ADMINISTRATIVE").toBe(0);
    expect(getVac.administrativeDays, "API shows administrativeDays=1 for ADMINISTRATIVE").toBe(1);

    // Step 5: Query DB — compare with API representation
    const db = new DbClient(tttConfig);
    try {
      const dbRows = await db.query(
        `SELECT v.regular_days, v.administrative_days, v.payment_type,
                vp.regular_days AS payment_regular, vp.administrative_days AS payment_admin
         FROM ttt_vacation.vacation v
         LEFT JOIN ttt_vacation.vacation_payment vp ON v.vacation_payment_id = vp.id
         WHERE v.id = $1`,
        [createdVacationId],
      );

      expect(dbRows.length, "DB should have vacation record").toBeGreaterThanOrEqual(1);
      const dbRow = dbRows[0];

      const dbArtifact = testInfo.outputPath("step5-db-representation.json");
      await writeFile(dbArtifact, JSON.stringify({
        vacationId: createdVacationId,
        dbPaymentType: dbRow.payment_type,
        dbRegularDays: dbRow.regular_days,
        dbAdministrativeDays: dbRow.administrative_days,
        paymentRegularDays: dbRow.payment_regular,
        paymentAdminDays: dbRow.payment_admin,
        apiRegularDays: getVac.regularDays,
        apiAdministrativeDays: getVac.administrativeDays,
        bug: "DB stores days in regular_days column even for ADMINISTRATIVE; API transposes based on payment_type",
      }, null, 2), "utf-8");
      await testInfo.attach("step5-db-representation", { path: dbArtifact, contentType: "application/json" });

      // BUG: DB stores ADMINISTRATIVE vacation days in the regular_days column
      // The vacation table has regular_days=1, administrative_days=0 for an ADMINISTRATIVE vacation
      // But the API returns regularDays=0, administrativeDays=1 (transposed by DTO conversion)
      expect(
        dbRow.regular_days,
        "BUG: DB stores 1 in regular_days for ADMINISTRATIVE vacation",
      ).toBe(1);
      expect(
        dbRow.administrative_days,
        "BUG: DB stores 0 in administrative_days for ADMINISTRATIVE vacation",
      ).toBe(0);

      // Confirm the inconsistency: API and DB disagree
      const comparisonArtifact = testInfo.outputPath("step5-inconsistency.json");
      await writeFile(comparisonArtifact, JSON.stringify({
        field: "regular_days",
        dbValue: dbRow.regular_days,
        apiValue: getVac.regularDays,
        match: dbRow.regular_days === getVac.regularDays,
        field2: "administrative_days",
        dbValue2: dbRow.administrative_days,
        apiValue2: getVac.administrativeDays,
        match2: dbRow.administrative_days === getVac.administrativeDays,
        conclusion: "DB and API show opposite values — DTO transposes based on payment_type",
      }, null, 2), "utf-8");
      await testInfo.attach("step5-inconsistency", { path: comparisonArtifact, contentType: "application/json" });

      // The key assertion: DB and API disagree on which column holds the days
      expect(
        dbRow.regular_days !== getVac.regularDays,
        "BUG confirmed: DB regular_days differs from API regularDays",
      ).toBe(true);
    } finally {
      await db.close();
    }
  } finally {
    // PAID+EXACT cannot be deleted — attempt cancel+delete only if test failed before PAID
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
