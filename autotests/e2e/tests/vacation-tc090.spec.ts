import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc090Data } from "../data/VacationTc090Data";

test("vacation_tc090 - Pay with wrong day split (total mismatch) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc090Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create a REGULAR 5-day vacation
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

    const actualDays = createVac.regularDays;
    expect(actualDays, "vacation should have working days").toBeGreaterThan(0);

    // Step 2: Approve
    const approveResponse = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    const approveBody = await approveResponse.json();
    const approveArtifact = testInfo.outputPath("step2-approve.json");
    await writeFile(approveArtifact, JSON.stringify(approveBody, null, 2), "utf-8");
    await testInfo.attach("step2-approve", { path: approveArtifact, contentType: "application/json" });

    expect(approveResponse.status()).toBe(200);
    const approveVac = approveBody.vacation ?? approveBody;
    expect(approveVac.status).toBe("APPROVED");

    // Step 3: Pay with WRONG day split (regularDaysPayed + administrativeDaysPayed != vacation.days)
    // Send sum=4 when vacation has 5 working days
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildWrongPayBody(),
      },
    );

    const payBody = await payResponse.json();
    const payArtifact = testInfo.outputPath("step3-pay-rejected.json");
    await writeFile(payArtifact, JSON.stringify(payBody, null, 2), "utf-8");
    await testInfo.attach("step3-pay-rejected", { path: payArtifact, contentType: "application/json" });

    expect(payResponse.status(), "Pay with wrong split should return 400").toBe(400);

    // Verify error code — checkForPayment validates total days match
    const errorCode = payBody.errorCode ?? "";
    const errorMessage = payBody.message ?? "";
    const hasPayDaysError =
      errorCode.includes("pay.days.not.equal") ||
      errorMessage.includes("pay.days.not.equal");
    expect(hasPayDaysError, `Expected pay.days.not.equal error, got errorCode=${errorCode}, message=${errorMessage}`).toBe(true);

    // Step 4: Verify vacation remains APPROVED (payment was rejected)
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step4-still-approved.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step4-still-approved", { path: getArtifact, contentType: "application/json" });

    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status, "Status should remain APPROVED after failed payment").toBe("APPROVED");
  } finally {
    // Cleanup: vacation is still APPROVED, cancel then delete
    if (createdVacationId) {
      await request.put(`${baseUrl}/cancel/${createdVacationId}`, {
        headers: authHeaders,
      });
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
