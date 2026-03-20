import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc050Data } from "../data/VacationTc050Data";

test("vacation_tc050 - PAID terminal state: all transitions blocked @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc050Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create vacation (NEW)
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

    const regularDays = createVac.regularDays;
    expect(regularDays).toBeGreaterThan(0);

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

    // Step 3: Pay
    const payResponse = await request.put(
      `${baseUrl}/pay/${createdVacationId}`,
      {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildPayBody(regularDays),
      },
    );

    const payBody = await payResponse.json();
    const payArtifact = testInfo.outputPath("step3-pay.json");
    await writeFile(payArtifact, JSON.stringify(payBody, null, 2), "utf-8");
    await testInfo.attach("step3-pay", { path: payArtifact, contentType: "application/json" });

    expect(payResponse.status(), "Pay should return 200").toBe(200);
    const payVac = payBody.vacation ?? payBody;
    expect(payVac.status).toBe("PAID");

    // Step 4: Try APPROVE on PAID vacation — must fail
    const approveAgainResp = await request.put(
      `${baseUrl}/approve/${createdVacationId}`,
      { headers: authHeaders },
    );

    let approveAgainBody: Record<string, unknown> = {};
    try { approveAgainBody = await approveAgainResp.json(); } catch { /* empty */ }
    const approveAgainArtifact = testInfo.outputPath("step4-approve-paid.json");
    await writeFile(approveAgainArtifact, JSON.stringify({ status: approveAgainResp.status(), body: approveAgainBody }, null, 2), "utf-8");
    await testInfo.attach("step4-approve-paid", { path: approveAgainArtifact, contentType: "application/json" });

    expect(
      [400, 403].includes(approveAgainResp.status()),
      `Approve PAID should fail, got ${approveAgainResp.status()}`,
    ).toBe(true);

    // Step 5: Try REJECT on PAID vacation — must fail
    const rejectResp = await request.put(
      `${baseUrl}/reject/${createdVacationId}`,
      { headers: authHeaders },
    );

    let rejectBody: Record<string, unknown> = {};
    try { rejectBody = await rejectResp.json(); } catch { /* empty */ }
    const rejectArtifact = testInfo.outputPath("step5-reject-paid.json");
    await writeFile(rejectArtifact, JSON.stringify({ status: rejectResp.status(), body: rejectBody }, null, 2), "utf-8");
    await testInfo.attach("step5-reject-paid", { path: rejectArtifact, contentType: "application/json" });

    expect(
      [400, 403].includes(rejectResp.status()),
      `Reject PAID should fail, got ${rejectResp.status()}`,
    ).toBe(true);

    // Step 6: Try CANCEL on PAID vacation — must fail
    const cancelResp = await request.put(
      `${baseUrl}/cancel/${createdVacationId}`,
      { headers: authHeaders },
    );

    let cancelBody: Record<string, unknown> = {};
    try { cancelBody = await cancelResp.json(); } catch { /* empty */ }
    const cancelArtifact = testInfo.outputPath("step6-cancel-paid.json");
    await writeFile(cancelArtifact, JSON.stringify({ status: cancelResp.status(), body: cancelBody }, null, 2), "utf-8");
    await testInfo.attach("step6-cancel-paid", { path: cancelArtifact, contentType: "application/json" });

    expect(
      [400, 403].includes(cancelResp.status()),
      `Cancel PAID should fail, got ${cancelResp.status()}`,
    ).toBe(true);

    // Step 7: Try DELETE on PAID vacation — must fail
    const deleteResp = await request.delete(
      `${baseUrl}/${createdVacationId}`,
      { headers: authHeaders },
    );

    let deleteBody: Record<string, unknown> = {};
    try { deleteBody = await deleteResp.json(); } catch { /* empty */ }
    const deleteArtifact = testInfo.outputPath("step7-delete-paid.json");
    await writeFile(deleteArtifact, JSON.stringify({ status: deleteResp.status(), body: deleteBody }, null, 2), "utf-8");
    await testInfo.attach("step7-delete-paid", { path: deleteArtifact, contentType: "application/json" });

    expect(
      [400, 403].includes(deleteResp.status()),
      `Delete PAID should fail, got ${deleteResp.status()}`,
    ).toBe(true);

    // Step 8: Verify vacation is still PAID (unchanged)
    const getResponse = await request.get(`${baseUrl}/${createdVacationId}`, {
      headers: authHeaders,
    });
    const getBody = await getResponse.json();
    const getArtifact = testInfo.outputPath("step8-verify-still-paid.json");
    await writeFile(getArtifact, JSON.stringify(getBody, null, 2), "utf-8");
    await testInfo.attach("step8-verify-still-paid", { path: getArtifact, contentType: "application/json" });

    expect(getResponse.status()).toBe(200);
    const getVac = getBody.vacation ?? getBody;
    expect(getVac.status, "Status should still be PAID after all failed transitions").toBe("PAID");
  } finally {
    // PAID vacations cannot be deleted — cleanup is best-effort only
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
