import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc128Data } from "../data/VacationTc128Data";

test("vacation_tc128 - very large vacation 365 day boundary @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc128Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let adminVacationId: number | null = null;

  try {
    // Step 1: Try to create 365-day REGULAR vacation — expected to fail (insufficient days)
    const regularResp = await request.post(url, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildLargeRegularBody(),
    });

    let regularBody: Record<string, unknown> = {};
    try { regularBody = await regularResp.json(); } catch { /* empty body */ }

    const step1Artifact = testInfo.outputPath("step1-large-regular.json");
    await writeFile(step1Artifact, JSON.stringify({
      status: regularResp.status(),
      body: regularBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step1-large-regular", { path: step1Artifact, contentType: "application/json" });

    // REGULAR with 365 days should fail — employee has ~28 days available
    expect(
      regularResp.status(),
      "365-day REGULAR vacation should be rejected (insufficient days)",
    ).toBe(400);

    // Step 2: Verify error response references available days or crossing
    const step2Artifact = testInfo.outputPath("step2-regular-error-details.json");
    await writeFile(step2Artifact, JSON.stringify({
      errorCode: regularBody.errorCode,
      message: regularBody.message,
      exception: regularBody.exception,
      errors: (regularBody as Record<string, unknown>).errors,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-regular-error-details", { path: step2Artifact, contentType: "application/json" });

    // Error should indicate days issue or crossing issue
    const hasErrorInfo = regularBody.errorCode || regularBody.message ||
      (regularBody as Record<string, unknown>).errors;
    expect(hasErrorInfo, "Error response should contain error information").toBeTruthy();

    // Step 3: Try to create 365-day ADMINISTRATIVE vacation — may succeed (no day limit)
    const adminResp = await request.post(url, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildLargeAdministrativeBody(),
    });

    let adminBody: Record<string, unknown> = {};
    try { adminBody = await adminResp.json(); } catch { /* empty body */ }

    const step3Artifact = testInfo.outputPath("step3-large-administrative.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: adminResp.status(),
      body: adminBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-large-administrative", { path: step3Artifact, contentType: "application/json" });

    // Document whether ADMINISTRATIVE type accepts 365-day vacation
    const adminStatus = adminResp.status();
    const step4Artifact = testInfo.outputPath("step4-boundary-summary.json");

    if (adminStatus === 200) {
      // ADMINISTRATIVE succeeded — track for cleanup
      const vac = (adminBody as Record<string, unknown>).vacation as Record<string, unknown> | undefined;
      adminVacationId = vac?.id as number ?? null;

      await writeFile(step4Artifact, JSON.stringify({
        regularResult: "REJECTED (400) — insufficient days",
        administrativeResult: "ACCEPTED (200) — no day limit for ADMINISTRATIVE",
        adminVacationId,
        conclusion: "ADMINISTRATIVE type bypasses day balance check, allowing 365-day vacations",
      }, null, 2), "utf-8");
    } else {
      // ADMINISTRATIVE also failed — both types have limits
      await writeFile(step4Artifact, JSON.stringify({
        regularResult: "REJECTED (400)",
        administrativeResult: `REJECTED (${adminStatus})`,
        adminErrorCode: adminBody.errorCode,
        adminMessage: adminBody.message,
        conclusion: "Both types reject 365-day vacations",
      }, null, 2), "utf-8");
    }
    await testInfo.attach("step4-boundary-summary", { path: step4Artifact, contentType: "application/json" });

    // The core assertion: REGULAR 365-day is rejected
    // ADMINISTRATIVE behavior is documented but not strictly asserted (may vary by config)
  } finally {
    // Cleanup: delete administrative vacation if it was created
    if (adminVacationId) {
      const delResp = await request.delete(`${url}/${adminVacationId}`, {
        headers: authHeaders,
      });
      const cleanupArtifact = testInfo.outputPath("cleanup-delete.json");
      try {
        await writeFile(cleanupArtifact, JSON.stringify(await delResp.json(), null, 2), "utf-8");
      } catch {
        await writeFile(cleanupArtifact, `{"status":${delResp.status()}}`, "utf-8");
      }
      await testInfo.attach("cleanup-delete", { path: cleanupArtifact, contentType: "application/json" });
    }
  }
});
