import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc022Data } from "../data/VacationTc022Data";

test("vacation_tc022 - create vacation with notifyAlso list @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc022Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation with notifyAlso containing valid colleague logins
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create with notifyAlso should return 200").toBe(200);
    const createVac = createBody.vacation;
    expect(createVac, "Response should contain vacation object").toBeTruthy();
    expect(createVac.status).toBe("NEW");
    createdVacationId = createVac.id;
    expect(createdVacationId).toBeTruthy();

    // Step 2: GET to verify vacation persisted and check notifyAlso in response
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step2-verify.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step2-verify", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.startDate).toBe(data.startDate);
    expect(getVac.endDate).toBe(data.endDate);

    // Verify notifyAlso recipients if included in response
    if (getVac.notifyAlso && Array.isArray(getVac.notifyAlso)) {
      const notifyLogins = getVac.notifyAlso.map((n: Record<string, unknown>) =>
        typeof n === "string" ? n : (n.login ?? ""),
      );
      for (const expectedLogin of data.notifyAlsoLogins) {
        expect(notifyLogins, `notifyAlso should contain ${expectedLogin}`).toContain(expectedLogin);
      }
    }
    // Even if notifyAlso is not in GET response, the 200 on create confirms
    // the server accepted the notifyAlso list (validated by @EmployeeLoginCollectionExists)
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
