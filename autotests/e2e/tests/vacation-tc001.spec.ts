import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc001Data } from "../data/VacationTc001Data";

test("vacation_tc001 - create REGULAR vacation happy path (AV=false) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc001Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: POST create vacation
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createArtifact = testInfo.outputPath("step1-create-response.json");
    const createBody = await createResponse.json();
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-response", { path: createArtifact, contentType: "application/json" });

    // Step 2: Verify creation response (API wraps in { vacation, vacationDays })
    expect(createResponse.status(), `Expected 200, got ${createResponse.status()}`).toBe(200);
    const vac = createBody.vacation;
    expect(vac, "Response should contain vacation object").toBeTruthy();
    expect(vac.status).toBe("NEW");
    expect(vac.paymentType).toBe(data.paymentType);

    createdVacationId = vac.id;
    expect(createdVacationId, "Vacation ID should be returned").toBeTruthy();

    // Approver should be auto-assigned
    expect(vac.approver, "Approver should be auto-assigned").toBeTruthy();

    // Step 3: GET created vacation to confirm persistence
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    expect(getResponse.status()).toBe(200);

    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step3-get-vacation.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step3-get-vacation", { path: getArtifact, contentType: "application/json" });

    // GET may return { vacation: {...} } or flat — handle both
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("NEW");
    expect(getVac.startDate).toBe(data.startDate);
    expect(getVac.endDate).toBe(data.endDate);
    expect(getVac.paymentType).toBe(data.paymentType);
  } finally {
    // Cleanup: DELETE the created vacation
    if (createdVacationId) {
      const deleteResponse = await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
      const deleteArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        const deleteBody = await deleteResponse.json();
        await writeFile(deleteArtifact, JSON.stringify(deleteBody, null, 2), "utf-8");
      } catch {
        await writeFile(deleteArtifact, JSON.stringify({ status: deleteResponse.status() }, null, 2), "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: deleteArtifact, contentType: "application/json" });
    }
  }
});
