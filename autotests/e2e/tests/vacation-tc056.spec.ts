import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc056Data } from "../data/VacationTc056Data";

test("vacation_tc056 - Approve with crossing vacation blocked @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc056Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const approveUrl = tttConfig.buildUrl(data.approveEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdIdA: number | null = null;
  let createdIdB: number | null = null;

  try {
    // Step 1: Create vacation A (Mon-Fri, 5 days)
    const respA = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBodyA(),
    });

    const bodyA = await respA.json();
    const step1Artifact = testInfo.outputPath("step1-create-A.json");
    await writeFile(step1Artifact, JSON.stringify(bodyA, null, 2), "utf-8");
    await testInfo.attach("step1-create-A", { path: step1Artifact, contentType: "application/json" });

    expect(respA.status(), "Create A should return 200").toBe(200);
    createdIdA = bodyA.vacation?.id;
    expect(createdIdA, "Vacation A must have an ID").toBeTruthy();

    // Step 2: Create vacation B (overlapping Wed-Tue)
    // If creation crossing check blocks NEW vs NEW overlap, this returns 400
    const respB = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBodyB(),
    });

    let bodyB: Record<string, unknown> = {};
    try { bodyB = await respB.json(); } catch { /* empty */ }

    const step2Artifact = testInfo.outputPath("step2-create-B.json");
    await writeFile(step2Artifact, JSON.stringify({ status: respB.status(), body: bodyB }, null, 2), "utf-8");
    await testInfo.attach("step2-create-B", { path: step2Artifact, contentType: "application/json" });

    if (respB.status() === 400) {
      // Crossing check fires at creation time for overlapping vacations
      const crossingArtifact = testInfo.outputPath("step2-crossing-at-creation.json");
      await writeFile(crossingArtifact, JSON.stringify({
        finding: "Crossing check enforced at creation time — cannot create overlapping vacations even as NEW",
        errorBody: bodyB,
        datesA: { start: data.startDateA, end: data.endDateA },
        datesB: { start: data.startDateB, end: data.endDateB },
      }, null, 2), "utf-8");
      await testInfo.attach("step2-crossing-at-creation", { path: crossingArtifact, contentType: "application/json" });

      const msg = String(bodyB.message ?? bodyB.errorCode ?? "");
      expect(msg, "Error should mention crossing").toContain("crossing");
      // Test passes — crossing validation confirmed at creation
      return;
    }

    expect(respB.status(), "Create B should return 200").toBe(200);
    createdIdB = (bodyB as Record<string, Record<string, unknown>>).vacation?.id as number;
    expect(createdIdB, "Vacation B must have an ID").toBeTruthy();

    // Step 3: Approve B → APPROVED
    const approveRespB = await request.post(`${approveUrl}/${createdIdB}`, {
      headers: authHeaders,
    });

    let approveBBody: Record<string, unknown> = {};
    try { approveBBody = await approveRespB.json(); } catch { /* empty */ }

    const step3Artifact = testInfo.outputPath("step3-approve-B.json");
    await writeFile(step3Artifact, JSON.stringify({ status: approveRespB.status(), body: approveBBody }, null, 2), "utf-8");
    await testInfo.attach("step3-approve-B", { path: step3Artifact, contentType: "application/json" });

    expect(approveRespB.status(), "Approve B should succeed with 200").toBe(200);

    // Step 4: Try to approve A — should fail with crossing error
    const approveRespA = await request.post(`${approveUrl}/${createdIdA}`, {
      headers: authHeaders,
    });

    let approveABody: Record<string, unknown> = {};
    try { approveABody = await approveRespA.json(); } catch { /* empty */ }

    const step4Artifact = testInfo.outputPath("step4-approve-A-blocked.json");
    await writeFile(step4Artifact, JSON.stringify({
      status: approveRespA.status(),
      body: approveABody,
      expectedStatus: 400,
      expectedError: "exception.validation.vacation.dates.crossing",
      datesA: { start: data.startDateA, end: data.endDateA },
      datesB: { start: data.startDateB, end: data.endDateB },
    }, null, 2), "utf-8");
    await testInfo.attach("step4-approve-A-blocked", { path: step4Artifact, contentType: "application/json" });

    expect(approveRespA.status(), "Approve A should return 400 (crossing)").toBe(400);
    const errorMsg = String(approveABody.message ?? approveABody.errorCode ?? "");
    expect(errorMsg, "Error should mention crossing").toContain("crossing");
  } finally {
    // Cleanup: cancel APPROVED vacation B, then delete both
    if (createdIdB) {
      const cancelUrl = tttConfig.buildUrl(`/api/vacation/v1/vacations/cancel/${createdIdB}`);
      await request.put(cancelUrl, { headers: authHeaders });
      await request.delete(`${vacUrl}/${createdIdB}`, { headers: authHeaders });
    }
    if (createdIdA) {
      await request.delete(`${vacUrl}/${createdIdA}`, { headers: authHeaders });
    }
  }
});
