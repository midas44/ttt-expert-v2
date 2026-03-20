import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc029Data } from "../data/VacationTc029Data";

test("vacation_tc029 - update REJECTED vacation (day limit checks skipped) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc029Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation in NEW status
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

    // Step 3: PUT update with new dates on REJECTED vacation
    const updateResponse = await request.put(
      `${baseUrl}/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildUpdateBody(createdVacationId!),
      },
    );

    const updateBody = await updateResponse.json();
    const updateArtifact = testInfo.outputPath("step3-update.json");
    await writeFile(updateArtifact, JSON.stringify(updateBody, null, 2), "utf-8");
    await testInfo.attach("step3-update", { path: updateArtifact, contentType: "application/json" });

    expect(updateResponse.status(), "Update of REJECTED vacation should return 200").toBe(200);
    const updateVac = updateBody.vacation ?? updateBody;

    // Verify dates are updated
    expect(updateVac.startDate, "Start date should be updated").toBe(data.updatedStartDate);
    expect(updateVac.endDate, "End date should be updated").toBe(data.updatedEndDate);

    // Document resulting status — REJECTED→NEW transition may occur
    const statusArtifact = testInfo.outputPath("status-result.json");
    await writeFile(statusArtifact, JSON.stringify({
      statusBefore: "REJECTED",
      statusAfter: updateVac.status,
      transitionOccurred: updateVac.status !== "REJECTED",
    }, null, 2), "utf-8");
    await testInfo.attach("status-result", { path: statusArtifact, contentType: "application/json" });

    // Step 4: GET to confirm update persisted
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-verify", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.startDate).toBe(data.updatedStartDate);
    expect(getVac.endDate).toBe(data.updatedEndDate);
  } finally {
    // Cleanup: cancel (if re-opened to NEW) then delete
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
