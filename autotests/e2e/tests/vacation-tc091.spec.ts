import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc091Data } from "../data/VacationTc091Data";

test("vacation_tc091 - Pay already PAID vacation (double payment blocked) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc091Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create REGULAR vacation (NEW)
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

    // Step 3: Pay (first time — should succeed)
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildPayBody(regularDays),
      },
    );

    const payBody = await payResponse.json();
    const payArtifact = testInfo.outputPath("step3-pay-first.json");
    await writeFile(payArtifact, JSON.stringify(payBody, null, 2), "utf-8");
    await testInfo.attach("step3-pay-first", { path: payArtifact, contentType: "application/json" });

    expect(payResponse.status(), "First payment should return 200").toBe(200);
    const payVac = payBody.vacation ?? payBody;
    expect(payVac.status).toBe("PAID");

    // Step 4: Pay again (second time — should be blocked)
    const payAgainResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildPayBody(regularDays),
      },
    );

    let payAgainBody: Record<string, unknown> = {};
    try { payAgainBody = await payAgainResponse.json(); } catch { /* empty */ }

    const payAgainArtifact = testInfo.outputPath("step4-pay-second-blocked.json");
    await writeFile(payAgainArtifact, JSON.stringify({
      status: payAgainResponse.status(),
      body: payAgainBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step4-pay-second-blocked", { path: payAgainArtifact, contentType: "application/json" });

    expect(
      payAgainResponse.status(),
      `Second payment should be rejected with 400, got ${payAgainResponse.status()}`,
    ).toBe(400);

    // Verify error indicates terminal state / status not allowed
    const errorCode = String(payAgainBody.errorCode ?? "");
    const errorMessage = String(payAgainBody.message ?? "");
    expect(
      errorCode.includes("status") || errorCode.includes("notAllowed") ||
      errorMessage.includes("status") || errorMessage.includes("notAllowed") ||
      payAgainResponse.status() === 400,
      `Error should indicate status not allowed: errorCode=${errorCode}, message=${errorMessage}`,
    ).toBe(true);

    // Step 5: Verify vacation is still PAID
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step5-still-paid.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step5-still-paid", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status, "Status should still be PAID after rejected double payment").toBe("PAID");
  } finally {
    // PAID vacations cannot be deleted — cleanup is best-effort
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
