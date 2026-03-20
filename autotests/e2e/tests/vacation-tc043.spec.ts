import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc043Data } from "../data/VacationTc043Data";

test("vacation_tc043 - REJECTED to APPROVED re-approval without edit @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc043Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation (NEW status)
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
    expect(createdVacationId).toBeTruthy();

    // Step 2: Reject the vacation (NEW → REJECTED)
    const rejectResponse = await request.put(
      `${baseUrl}/reject/${createdVacationId}`,
      { headers: authHeaders },
    );

    const rejectBody = await rejectResponse.json();
    const rejectArtifact = testInfo.outputPath("step2-reject.json");
    await writeFile(rejectArtifact, JSON.stringify(rejectBody, null, 2), "utf-8");
    await testInfo.attach("step2-reject", { path: rejectArtifact, contentType: "application/json" });

    expect(rejectResponse.status(), "Reject should return 200").toBe(200);
    const rejectVac = rejectBody.vacation ?? rejectBody;
    expect(rejectVac.status).toBe("REJECTED");

    // Step 3: Approve directly (REJECTED → APPROVED) without editing
    // This transition is allowed: add(REJECTED, APPROVED, PM/DM/ADMIN)
    const approveResponse = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    const approveBody = await approveResponse.json();
    const approveArtifact = testInfo.outputPath("step3-approve.json");
    await writeFile(approveArtifact, JSON.stringify(approveBody, null, 2), "utf-8");
    await testInfo.attach("step3-approve", { path: approveArtifact, contentType: "application/json" });

    expect(approveResponse.status(), "Re-approval should return 200").toBe(200);
    const approveVac = approveBody.vacation ?? approveBody;
    expect(approveVac.status, "Status should transition to APPROVED").toBe("APPROVED");

    // Verify dates are unchanged (no edit was made between reject and approve)
    expect(approveVac.startDate).toBe(data.startDate);
    expect(approveVac.endDate).toBe(data.endDate);

    // Step 4: GET to confirm persistence
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-verify", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("APPROVED");
  } finally {
    // Cleanup: cancel (APPROVED→CANCELED) then delete
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
