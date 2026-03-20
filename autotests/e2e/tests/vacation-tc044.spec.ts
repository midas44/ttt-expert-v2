import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc044Data } from "../data/VacationTc044Data";

test("vacation_tc044 - APPROVED to NEW (employee edits dates) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc044Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create a vacation in NEW status
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

    // Step 3: Update dates (PUT /{id}) — should reset status to NEW
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

    expect(updateResponse.status(), "Update should return 200").toBe(200);
    const updateVac = updateBody.vacation ?? updateBody;
    expect(updateVac.status, "Status should reset from APPROVED to NEW").toBe("NEW");
    expect(updateVac.startDate).toBe(data.updatedStartDate);
    expect(updateVac.endDate).toBe(data.updatedEndDate);

    // Step 4: GET to confirm status persisted as NEW
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-verify", { path: getArtifact, contentType: "application/json" });

    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("NEW");
  } finally {
    // Cleanup: delete the vacation (NEW status allows direct delete)
    if (createdVacationId) {
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
