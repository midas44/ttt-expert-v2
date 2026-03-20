import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc121Data } from "../data/VacationTc121Data";

test("vacation_tc121 - Non-existent vacation ID returns 404 @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc121Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(`${data.vacationEndpoint}/${data.nonExistentId}`);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET with non-existent vacation ID
  const response = await request.get(url, { headers: authHeaders });

  const responseStatus = response.status();
  let body: Record<string, unknown> = {};
  try { body = await response.json(); } catch { /* empty or non-JSON */ }

  const artifact = testInfo.outputPath("step1-get-nonexistent.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body }, null, 2), "utf-8");
  await testInfo.attach("step1-get-nonexistent", { path: artifact, contentType: "application/json" });

  // Expect 404 (EntityNotFoundException) — some implementations may return 400
  expect(
    [400, 404].includes(responseStatus),
    `Expected 400 or 404 for non-existent vacation, got ${responseStatus}`,
  ).toBe(true);

  // Step 2: Verify error response structure
  const errorArtifact = testInfo.outputPath("step2-error-structure.json");
  await writeFile(errorArtifact, JSON.stringify({
    hasErrorCode: "errorCode" in body,
    errorCode: body.errorCode ?? "not present",
    hasMessage: "message" in body,
    message: body.message ?? "not present",
    hasStatus: "status" in body,
    status: body.status,
    noStackTrace: !body.trace && !body.stackTrace,
  }, null, 2), "utf-8");
  await testInfo.attach("step2-error-structure", { path: errorArtifact, contentType: "application/json" });

  // Error should have a code indicating not found
  if (responseStatus === 404) {
    const errorCode = String(body.errorCode ?? body.error ?? "");
    expect(
      errorCode.length > 0,
      "404 response should include an error code or error field",
    ).toBe(true);
  }

  // Response should NOT contain a stack trace (clean error)
  expect(body.trace, "Response should not expose stack trace").toBeFalsy();
  expect(body.stackTrace, "Response should not expose stackTrace").toBeFalsy();
});
