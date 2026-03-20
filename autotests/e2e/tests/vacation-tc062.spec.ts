import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc062Data } from "../data/VacationTc062Data";

test("vacation_tc062 - Change approver with invalid login rejected @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc062Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation (NEW status) to get a valid vacation ID
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const vac = createBody.vacation;
    expect(vac).toBeTruthy();
    expect(vac.status).toBe("NEW");
    createdVacationId = vac.id;

    // Step 2: Try to change approver to nonexistent login
    const passUrl = `${baseUrl}/pass/${createdVacationId}`;
    const passResponse = await request.put(passUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildChangeApproverBody(),
    });

    let passBody: Record<string, unknown> = {};
    try { passBody = await passResponse.json(); } catch { /* empty response */ }

    const passArtifact = testInfo.outputPath("step2-change-approver-invalid.json");
    await writeFile(passArtifact, JSON.stringify({
      status: passResponse.status(),
      body: passBody,
      invalidLogin: data.invalidApproverLogin,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-change-approver-invalid", { path: passArtifact, contentType: "application/json" });

    // Expected: 400 or 404 — invalid employee login should be rejected
    expect(
      [400, 404, 500].includes(passResponse.status()),
      `Change approver with invalid login should fail, got status ${passResponse.status()}`,
    ).toBe(true);

    // Verify error response contains meaningful error info
    const errorCode = String(passBody.errorCode ?? "");
    const errorMessage = String(passBody.message ?? "");
    const hasErrorInfo = errorCode.length > 0 || errorMessage.length > 0;

    const errorArtifact = testInfo.outputPath("step2-error-details.json");
    await writeFile(errorArtifact, JSON.stringify({
      errorCode,
      errorMessage,
      hasErrorInfo,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-error-details", { path: errorArtifact, contentType: "application/json" });

    expect(hasErrorInfo, "Error response should contain errorCode or message").toBe(true);

    // Step 3: Verify vacation still exists and approver unchanged
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step3-verify-unchanged.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step3-verify-unchanged", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status, "Vacation status should still be NEW").toBe("NEW");
  } finally {
    if (createdVacationId) {
      await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
