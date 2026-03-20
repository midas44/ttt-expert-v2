import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc028Data } from "../data/VacationTc028Data";

test("vacation_tc028 - update CANCELED vacation (day limit checks skipped) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc028Data.create(globalConfig.testDataMode, tttConfig);

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

    // Step 2: Cancel the vacation (NEW → CANCELED)
    const cancelResponse = await request.put(
      `${baseUrl}/cancel/${createdVacationId}`,
      { headers: authHeaders },
    );

    const cancelBody = await cancelResponse.json();
    const cancelArtifact = testInfo.outputPath("step2-cancel.json");
    await writeFile(cancelArtifact, JSON.stringify(cancelBody, null, 2), "utf-8");
    await testInfo.attach("step2-cancel", { path: cancelArtifact, contentType: "application/json" });

    expect(cancelResponse.status(), "Cancel should return 200").toBe(200);
    const cancelVac = cancelBody.vacation ?? cancelBody;
    expect(cancelVac.status).toBe("CANCELED");

    // Step 3: PUT update with new dates on CANCELED vacation
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

    expect(updateResponse.status(), "Update of CANCELED vacation should return 200").toBe(200);
    const updateVac = updateBody.vacation ?? updateBody;

    // Verify dates are updated
    expect(updateVac.startDate, "Start date should be updated").toBe(data.updatedStartDate);
    expect(updateVac.endDate, "End date should be updated").toBe(data.updatedEndDate);

    // Document resulting status — CANCELED→NEW transition may occur
    const statusArtifact = testInfo.outputPath("status-result.json");
    await writeFile(statusArtifact, JSON.stringify({
      statusBefore: "CANCELED",
      statusAfter: updateVac.status,
      transitionOccurred: updateVac.status !== "CANCELED",
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
    // Cleanup: cancel (if re-opened) then delete
    if (createdVacationId) {
      // Try cancel first in case status is NEW (from CANCELED→NEW transition)
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
