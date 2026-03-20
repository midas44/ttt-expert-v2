import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc123Data } from "../data/VacationTc123Data";

test("vacation_tc123 - type mismatch string for numeric ID returns 400 @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc123Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(`${data.vacationEndpoint}/${data.stringId}`);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET /vacations/abc — string where numeric vacationId expected
  const response = await request.get(url, { headers: authHeaders });

  const responseStatus = response.status();
  let body: Record<string, unknown> = {};
  try { body = await response.json(); } catch { /* non-JSON */ }

  const artifact = testInfo.outputPath("step1-type-mismatch.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body }, null, 2), "utf-8");
  await testInfo.attach("step1-type-mismatch", { path: artifact, contentType: "application/json" });

  // Expect HTTP 400 (MethodArgumentTypeMismatchException)
  expect(responseStatus, `Expected 400 for type mismatch, got ${responseStatus}`).toBe(400);

  // Step 2: Verify error code and message
  const errorCode = String(body.errorCode ?? "");
  const message = String(body.message ?? "");

  const step2Artifact = testInfo.outputPath("step2-error-details.json");
  await writeFile(step2Artifact, JSON.stringify({
    errorCode,
    message,
    exception: body.exception,
    hasTypeMismatchCode: errorCode.includes("type.mismatch"),
    messageIndicatesType: message.toLowerCase().includes("long") || message.toLowerCase().includes("convert") || message.toLowerCase().includes("type"),
  }, null, 2), "utf-8");
  await testInfo.attach("step2-error-details", { path: step2Artifact, contentType: "application/json" });

  // Verify errorCode is exception.type.mismatch
  expect(
    errorCode.includes("type.mismatch"),
    `Expected errorCode containing "type.mismatch", got: "${errorCode}"`,
  ).toBe(true);

  // Verify message indicates expected type (Long/numeric)
  const indicatesExpectedType =
    message.toLowerCase().includes("long") ||
    message.toLowerCase().includes("number") ||
    message.toLowerCase().includes("convert") ||
    message.toLowerCase().includes("type");

  expect(
    indicatesExpectedType,
    `Expected message indicating type conversion failure, got: "${message}"`,
  ).toBe(true);
});
