import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc052Data } from "../data/VacationTc052Data";

test("vacation_tc052 - invalid transition NEW to PAID (skipping approval) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc052Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation (status = NEW)
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

    const regularDays = createVac.regularDays ?? 5;

    // Step 2: Attempt to pay the NEW vacation (invalid: must be APPROVED first)
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildPayBody(regularDays),
      },
    );

    const payStatus = payResponse.status();
    let payBody: Record<string, unknown> = {};
    try {
      payBody = await payResponse.json();
    } catch {
      // Some error responses may be empty
    }

    const payArtifact = testInfo.outputPath("step2-pay-new.json");
    await writeFile(payArtifact, JSON.stringify({ status: payStatus, body: payBody }, null, 2), "utf-8");
    await testInfo.attach("step2-pay-new", { path: payArtifact, contentType: "application/json" });

    // No NEW→PAID transition in VacationStatusManager map
    expect(
      [400, 403].includes(payStatus),
      `Expected 400 or 403 for NEW→PAID transition, got ${payStatus}`,
    ).toBe(true);

    // Verify error code
    const errorCode = payBody.errorCode as string | undefined;
    if (errorCode) {
      expect(errorCode, "Error should indicate status not allowed").toContain("notAllowed");
    }

    // Step 3: GET to confirm vacation is still NEW (not paid)
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step3-verify-still-new.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step3-verify-still-new", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status, "Status should still be NEW after failed pay attempt").toBe("NEW");
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
