import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc126Data } from "../data/VacationTc126Data";

test.skip("vacation_tc126 - sick leave crossing vacation returns 409 CONFLICT @regress — SKIP: API_SECRET_TOKEN lacks AUTHENTICATED_USER authority for POST /sick-leaves (403)", async ({ request }, testInfo) => {
  // SKIP REASON: The sick leave create endpoint requires AUTHENTICATED_USER authority.
  // API_SECRET_TOKEN only grants VACATIONS_* authorities, not AUTHENTICATED_USER.
  // Needs per-user CAS JWT authentication to access the sick leave endpoint.
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc126Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const slUrl = tttConfig.buildUrl(data.sickLeaveEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let vacationId: number | null = null;

  try {
    // Step 1: Create a vacation (ADMINISTRATIVE to avoid day balance impact)
    const createVacResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildVacationBody(),
    });

    const vacBody = await createVacResp.json();
    const step1Artifact = testInfo.outputPath("step1-create-vacation.json");
    await writeFile(step1Artifact, JSON.stringify(vacBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-vacation", { path: step1Artifact, contentType: "application/json" });

    expect(createVacResp.status(), "Create vacation should return 200").toBe(200);
    vacationId = vacBody.vacation?.id ?? null;
    expect(vacationId, "Vacation ID must be returned").toBeTruthy();

    // Step 2: POST sick leave with dates overlapping the vacation (force=false)
    const createSlResp = await request.post(slUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildSickLeaveBody(),
    });

    const slStatus = createSlResp.status();
    let slBody: Record<string, unknown> = {};
    try { slBody = await createSlResp.json(); } catch { /* empty or non-JSON */ }

    const step2Artifact = testInfo.outputPath("step2-sick-leave-crossing.json");
    await writeFile(step2Artifact, JSON.stringify({ status: slStatus, body: slBody }, null, 2), "utf-8");
    await testInfo.attach("step2-sick-leave-crossing", { path: step2Artifact, contentType: "application/json" });

    // Step 3: Verify 409 CONFLICT — SickLeaveCrossingVacationException
    expect(slStatus, `Expected 409 CONFLICT for sick leave crossing vacation, got ${slStatus}`).toBe(409);

    // Verify error code
    const errorCode = String(slBody.errorCode ?? slBody.message ?? "");
    const step3Artifact = testInfo.outputPath("step3-error-details.json");
    await writeFile(step3Artifact, JSON.stringify({
      errorCode: slBody.errorCode,
      message: slBody.message,
      error: slBody.error,
      exception: slBody.exception,
      status: slBody.status,
      matchesExpectedCode: errorCode.includes("sick.leave.crossing.vacation"),
    }, null, 2), "utf-8");
    await testInfo.attach("step3-error-details", { path: step3Artifact, contentType: "application/json" });

    expect(
      errorCode.includes("sick.leave.crossing.vacation"),
      `Expected error code containing "sick.leave.crossing.vacation", got: "${errorCode}"`,
    ).toBe(true);

    // Verify status field in response body matches 409
    if (slBody.status !== undefined) {
      expect(slBody.status, "Body status should be 409").toBe(409);
    }

  } finally {
    // Cleanup: delete the vacation
    if (vacationId) {
      const delResp = await request.delete(`${vacUrl}/${vacationId}`, {
        headers: authHeaders,
      });
      const cleanupArtifact = testInfo.outputPath("cleanup-delete-vacation.json");
      try {
        await writeFile(cleanupArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(cleanupArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete-vacation", { path: cleanupArtifact, contentType: "application/json" });
    }
  }
});
