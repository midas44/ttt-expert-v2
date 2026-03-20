import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc048Data } from "../data/VacationTc048Data";

test("vacation_tc048 - APPROVED to PAID status transition (accountant pays) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc048Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create a REGULAR vacation in NEW status
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
    expect(createVac, "Response should contain vacation object").toBeTruthy();
    expect(createVac.status).toBe("NEW");
    createdVacationId = createVac.id;
    expect(createdVacationId).toBeTruthy();

    const regularDays = createVac.regularDays;
    expect(regularDays, "regularDays should be > 0 for a REGULAR vacation").toBeGreaterThan(0);

    // Step 2: Approve the vacation (PUT /approve/{id})
    const approveResponse = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    const approveBody = await approveResponse.json();
    const approveArtifact = testInfo.outputPath("step2-approve.json");
    await writeFile(approveArtifact, JSON.stringify(approveBody, null, 2), "utf-8");
    await testInfo.attach("step2-approve", { path: approveArtifact, contentType: "application/json" });

    expect(approveResponse.status(), "Approve should return 200").toBe(200);
    const approveVac = approveBody.vacation ?? approveBody;
    expect(approveVac.status).toBe("APPROVED");

    // Step 3: Pay the APPROVED vacation (PUT /pay/{id})
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
    expect(payVac.status, "Status should be PAID after payment").toBe("PAID");

    // Step 4: GET to confirm PAID status persisted
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-verify", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("PAID");

    // Step 5: Verify PAID is terminal — no further transitions possible
    // Try to cancel → should fail
    const cancelResponse = await request.put(
      `${baseUrl}/cancel/${createdVacationId}`,
      { headers: authHeaders },
    );
    const cancelArtifact = testInfo.outputPath("step5-cancel-blocked.json");
    try {
      await writeFile(cancelArtifact, JSON.stringify(await cancelResponse.json(), null, 2), "utf-8");
    } catch {
      await writeFile(cancelArtifact, `{"status":${cancelResponse.status()}}`, "utf-8");
    }
    await testInfo.attach("step5-cancel-blocked", { path: cancelArtifact, contentType: "application/json" });

    expect(cancelResponse.status(), "Cancel PAID should be rejected (400 or 403)").toBeGreaterThanOrEqual(400);
  } finally {
    // NOTE: PAID+EXACT vacations cannot be deleted via API.
    // The test record remains as a permanent fixture in the test environment.
    // We still attempt cleanup in case the test failed before reaching PAID.
    if (createdVacationId) {
      // Try cancel first (in case still APPROVED)
      await request.put(`${baseUrl}/cancel/${createdVacationId}`, {
        headers: authHeaders,
      });
      // Try delete (works for non-PAID statuses)
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
