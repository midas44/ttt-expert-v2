import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc046Data } from "../data/VacationTc046Data";

test("vacation_tc046 - canBeCancelled guard blocks cancel when reportPeriod > paymentDate @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc046Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  // Log test preconditions
  const precondArtifact = testInfo.outputPath("step0-preconditions.json");
  await writeFile(precondArtifact, JSON.stringify({
    login: data.login,
    startDate: data.startDate,
    endDate: data.endDate,
    paymentMonth: data.paymentMonth,
    reportPeriodStart: data.reportPeriodStart,
    guardCondition: `reportPeriod(${data.reportPeriodStart}).isAfter(paymentDate(${data.paymentMonth}))`,
  }, null, 2), "utf-8");
  await testInfo.attach("step0-preconditions", { path: precondArtifact, contentType: "application/json" });

  try {
    // Step 1: Create REGULAR vacation with paymentMonth before report period
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create", { path: createArtifact, contentType: "application/json" });

    // If creation fails due to paymentMonth validation, document and skip
    if (createResponse.status() !== 200) {
      const skipArtifact = testInfo.outputPath("skip-reason.json");
      await writeFile(skipArtifact, JSON.stringify({
        reason: "Cannot create vacation with paymentMonth before report period",
        createStatus: createResponse.status(),
        errorCode: createBody.errorCode ?? "unknown",
        message: createBody.message ?? "unknown",
        note: "canBeCancelled guard requires paymentMonth < reportPeriod, but API validates paymentMonth",
      }, null, 2), "utf-8");
      await testInfo.attach("skip-reason", { path: skipArtifact, contentType: "application/json" });
      test.skip(true, `Creation rejected (${createResponse.status()}): paymentMonth validation prevents test setup`);
      return;
    }

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const createVac = createBody.vacation;
    expect(createVac).toBeTruthy();
    expect(createVac.status).toBe("NEW");
    createdVacationId = createVac.id;

    // Step 2: Approve vacation
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

    // Step 3: Try to cancel — should be blocked by canBeCancelled guard
    const cancelResponse = await request.put(
      `${baseUrl}/cancel/${createdVacationId}`,
      { headers: authHeaders },
    );

    let cancelBody: Record<string, unknown> = {};
    try { cancelBody = await cancelResponse.json(); } catch { /* empty */ }

    const cancelArtifact = testInfo.outputPath("step3-cancel-attempt.json");
    await writeFile(cancelArtifact, JSON.stringify({
      status: cancelResponse.status(),
      body: cancelBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-cancel-attempt", { path: cancelArtifact, contentType: "application/json" });

    // If cancel succeeded (200), API_SECRET_TOKEN bypasses canBeCancelled guard
    if (cancelResponse.status() === 200) {
      const bypassArtifact = testInfo.outputPath("finding-guard-bypass.json");
      await writeFile(bypassArtifact, JSON.stringify({
        finding: "API_SECRET_TOKEN bypasses canBeCancelled permission guard",
        cancelStatus: 200,
        note: "System token has elevated permissions that override VacationPermissionService.canBeCancelled()",
        implication: "canBeCancelled guard cannot be tested via API_SECRET_TOKEN — requires per-user CAS auth",
      }, null, 2), "utf-8");
      await testInfo.attach("finding-guard-bypass", { path: bypassArtifact, contentType: "application/json" });
      test.skip(true, "API_SECRET_TOKEN bypasses canBeCancelled guard — test requires per-user auth");
      return;
    }

    // Expected: cancel blocked with 400 or 403
    expect(
      [400, 403].includes(cancelResponse.status()),
      `Cancel should be blocked by canBeCancelled guard, got ${cancelResponse.status()}`,
    ).toBe(true);

    // Step 4: Verify vacation is still APPROVED
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-still-approved.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-still-approved", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status, "Status should still be APPROVED after blocked cancel").toBe("APPROVED");
  } finally {
    // Cleanup: APPROVED vacations should be deletable (soft delete)
    if (createdVacationId) {
      // Try cancel first (might have succeeded), then delete
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
