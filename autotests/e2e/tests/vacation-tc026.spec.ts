import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc026Data } from "../data/VacationTc026Data";

test("vacation_tc026 - update dates of NEW vacation (status stays NEW) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc026Data.create(globalConfig.testDataMode, tttConfig);

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

    const originalDays = createVac.days;

    // Step 2: PUT update dates (shift to different week)
    const updateResponse = await request.put(
      `${baseUrl}/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildUpdateBody(createdVacationId!),
      },
    );

    const updateBody = await updateResponse.json();
    const updateArtifact = testInfo.outputPath("step2-update-dates.json");
    await writeFile(updateArtifact, JSON.stringify(updateBody, null, 2), "utf-8");
    await testInfo.attach("step2-update-dates", { path: updateArtifact, contentType: "application/json" });

    expect(updateResponse.status(), "Update should return 200").toBe(200);
    const updateVac = updateBody.vacation ?? updateBody;

    // Key assertion: status remains NEW (no reset — was already NEW)
    expect(updateVac.status, "Status should remain NEW").toBe("NEW");

    // Verify dates are updated
    expect(updateVac.startDate).toBe(data.updatedStartDate);
    expect(updateVac.endDate).toBe(data.updatedEndDate);

    // Days should be recalculated for new date range (same Mon-Fri span = 5 working days)
    expect(updateVac.regularDays, "Updated vacation should have recalculated regularDays").toBeGreaterThan(0);

    // Step 3: GET to confirm persistence
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step3-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step3-verify", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("NEW");
    expect(getVac.startDate).toBe(data.updatedStartDate);
    expect(getVac.endDate).toBe(data.updatedEndDate);
  } finally {
    // Cleanup: delete the vacation
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
