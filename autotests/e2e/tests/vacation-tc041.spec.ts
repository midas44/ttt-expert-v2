import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc041Data } from "../data/VacationTc041Data";

test("vacation_tc041 - NEW to CANCELED (employee cancels) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc041Data.create(globalConfig.testDataMode, tttConfig);

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

    // Step 2: Cancel the vacation (PUT /cancel/{id})
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

    // Step 3: GET to confirm status persisted
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step3-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step3-verify", { path: getArtifact, contentType: "application/json" });

    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("CANCELED");
  } finally {
    // Cleanup: delete the canceled vacation
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
