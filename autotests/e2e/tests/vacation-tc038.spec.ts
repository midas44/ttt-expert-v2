import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc038Data } from "../data/VacationTc038Data";

test("vacation_tc038 - Update payment month to closed accounting period rejected @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc038Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation with valid paymentMonth
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

    // Step 2: Try to update paymentMonth to a closed (past) accounting period
    const updateResponse = await request.put(
      `${baseUrl}/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildUpdateWithClosedPayment(createdVacationId!),
      },
    );

    let updateBody: Record<string, unknown> = {};
    try { updateBody = await updateResponse.json(); } catch { /* empty */ }

    const updateArtifact = testInfo.outputPath("step2-update-closed-payment.json");
    await writeFile(updateArtifact, JSON.stringify({
      status: updateResponse.status(),
      closedPaymentMonth: data.closedPaymentMonth,
      body: updateBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-update-closed-payment", { path: updateArtifact, contentType: "application/json" });

    // Expected: 400 — paymentMonth in closed period is rejected
    expect(
      updateResponse.status(),
      `Update with closed paymentMonth (${data.closedPaymentMonth}) should return 400`,
    ).toBe(400);

    // Verify error code
    const errorCode = String(updateBody.errorCode ?? "");
    const errorMessage = String(updateBody.message ?? "");

    const errorArtifact = testInfo.outputPath("step2-error-details.json");
    await writeFile(errorArtifact, JSON.stringify({
      errorCode,
      errorMessage,
      expectedCode: "validation.vacation.dates.payment",
    }, null, 2), "utf-8");
    await testInfo.attach("step2-error-details", { path: errorArtifact, contentType: "application/json" });

    const hasPaymentError =
      errorCode.includes("validation.vacation.dates.payment") ||
      errorMessage.includes("validation.vacation.dates.payment");
    expect(
      hasPaymentError,
      `Error should reference payment date validation, got errorCode="${errorCode}" message="${errorMessage}"`,
    ).toBe(true);

    // Step 3: Verify vacation still exists unchanged
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step3-verify-unchanged.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step3-verify-unchanged", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status, "Vacation should still be NEW after failed update").toBe("NEW");
  } finally {
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
