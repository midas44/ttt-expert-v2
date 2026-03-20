import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc042Data } from "../data/VacationTc042Data";

test("vacation_tc042 - NEW to DELETED (employee deletes) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc042Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;
  let deleted = false;

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

    // Step 2: Delete the vacation (DELETE /{id}) — soft delete
    const deleteResponse = await request.delete(
      `${baseUrl}/${createdVacationId}`,
      { headers: authHeaders },
    );

    const deleteArtifact = testInfo.outputPath("step2-delete.json");
    let deleteBody: Record<string, unknown> = {};
    try {
      deleteBody = await deleteResponse.json();
      await writeFile(deleteArtifact, JSON.stringify(deleteBody, null, 2), "utf-8");
    } catch {
      await writeFile(deleteArtifact, `{"status":${deleteResponse.status()}}`, "utf-8");
    }
    await testInfo.attach("step2-delete", { path: deleteArtifact, contentType: "application/json" });

    expect(deleteResponse.status(), "Delete should return 200").toBe(200);
    deleted = true;

    // Step 3: GET the deleted vacation — should still return it with DELETED status
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step3-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step3-verify", { path: getArtifact, contentType: "application/json" });

    // Soft delete: record persists with DELETED status
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status).toBe("DELETED");
  } finally {
    // Cleanup: delete if not already deleted
    if (createdVacationId && !deleted) {
      await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
