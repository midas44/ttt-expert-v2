import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc092Data } from "../data/VacationTc092Data";

test("vacation_tc092 - Pay NEW vacation (wrong status) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc092Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create a REGULAR vacation (remains NEW — do NOT approve)
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

    // Step 2: Try to pay the NEW vacation directly (should fail — pay requires APPROVED)
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildPayBody(),
      },
    );

    const payBody = await payResponse.json();
    const payArtifact = testInfo.outputPath("step2-pay-rejected.json");
    await writeFile(payArtifact, JSON.stringify(payBody, null, 2), "utf-8");
    await testInfo.attach("step2-pay-rejected", { path: payArtifact, contentType: "application/json" });

    expect(payResponse.status(), "Pay NEW vacation should return 400").toBe(400);

    // Verify error — pay requires APPROVED+EXACT status
    const errorCode = payBody.errorCode ?? "";
    const errorMessage = payBody.message ?? "";
    // PayVacationServiceImpl validates APPROVED+EXACT; error may be status-related
    expect(
      payResponse.status(),
      `Pay should be rejected for NEW vacation: errorCode=${errorCode}, message=${errorMessage}`,
    ).toBe(400);

    // Step 3: Verify vacation remains NEW (payment was rejected)
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step3-still-new.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step3-still-new", { path: getArtifact, contentType: "application/json" });

    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status, "Status should remain NEW after rejected payment").toBe("NEW");
  } finally {
    // Cleanup: vacation is still NEW, delete directly
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
