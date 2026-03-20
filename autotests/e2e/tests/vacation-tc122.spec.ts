import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc122Data } from "../data/VacationTc122Data";

test("vacation_tc122 - missing required fields returns validation errors array @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc122Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST with only login (missing startDate, endDate, paymentType)
  const response = await request.post(url, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildIncompleteBody(),
  });

  const responseStatus = response.status();
  let body: Record<string, unknown> = {};
  try { body = await response.json(); } catch { /* non-JSON */ }

  const artifact = testInfo.outputPath("step1-missing-fields.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body }, null, 2), "utf-8");
  await testInfo.attach("step1-missing-fields", { path: artifact, contentType: "application/json" });

  // Expect HTTP 400 (MethodArgumentNotValidException)
  expect(responseStatus, `Expected 400 for missing fields, got ${responseStatus}`).toBe(400);

  // Step 2: Verify errors array with per-field violations
  const errors = body.errors as Array<{ field?: string; code?: string; message?: string }> | undefined;

  const step2Artifact = testInfo.outputPath("step2-errors-array.json");
  await writeFile(step2Artifact, JSON.stringify({
    hasErrorsArray: Array.isArray(errors),
    errorsCount: errors?.length ?? 0,
    errors: errors ?? "not present",
    errorCode: body.errorCode,
    topLevelMessage: body.message,
  }, null, 2), "utf-8");
  await testInfo.attach("step2-errors-array", { path: step2Artifact, contentType: "application/json" });

  // Errors array must be present
  expect(Array.isArray(errors), "Response must contain errors array").toBe(true);

  // Verify per-field violations for each missing required field
  const errorFields = (errors ?? []).map((e) => e.field);
  for (const requiredField of data.expectedMissingFields) {
    expect(
      errorFields.includes(requiredField),
      `Expected field-level error for "${requiredField}", got fields: ${JSON.stringify(errorFields)}`,
    ).toBe(true);
  }

  // Each error should have a NotNull code or message
  for (const err of errors ?? []) {
    if (data.expectedMissingFields.includes(err.field ?? "")) {
      const hasNotNull =
        (err.code ?? "").toLowerCase().includes("notnull") ||
        (err.message ?? "").toLowerCase().includes("null") ||
        (err.message ?? "").toLowerCase().includes("must not be null");
      expect(
        hasNotNull,
        `Expected NotNull violation for field "${err.field}", got code="${err.code}", message="${err.message}"`,
      ).toBe(true);
    }
  }
});
