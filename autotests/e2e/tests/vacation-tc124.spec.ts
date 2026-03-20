import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc124Data } from "../data/VacationTc124Data";

test("vacation_tc124 - exception class leakage in error responses @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc124Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST with past dates to trigger ServiceException
  const response = await request.post(url, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildPastDateBody(),
  });

  const responseStatus = response.status();
  let body: Record<string, unknown> = {};
  try { body = await response.json(); } catch { /* non-JSON */ }

  const artifact = testInfo.outputPath("step1-past-date-error.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body }, null, 2), "utf-8");
  await testInfo.attach("step1-past-date-error", { path: artifact, contentType: "application/json" });

  // Expect HTTP 400
  expect(responseStatus, `Expected 400 for past date, got ${responseStatus}`).toBe(400);

  // Step 2: Verify exception field contains full Java class name (SECURITY ISSUE)
  const exceptionField = String(body.exception ?? "");

  const step2Artifact = testInfo.outputPath("step2-class-leakage.json");
  await writeFile(step2Artifact, JSON.stringify({
    exceptionField,
    containsDot: exceptionField.includes("."),
    containsException: exceptionField.includes("Exception"),
    containsPackage: exceptionField.includes("com.noveogroup") || exceptionField.includes("org.springframework"),
    leaksInternalStructure: exceptionField.includes("com.noveogroup.ttt"),
    responseFields: Object.keys(body),
  }, null, 2), "utf-8");
  await testInfo.attach("step2-class-leakage", { path: step2Artifact, contentType: "application/json" });

  // BUG VERIFICATION: exception field exposes full Java class name
  expect(
    exceptionField.includes("Exception"),
    `Expected Java exception class in "exception" field, got: "${exceptionField}"`,
  ).toBe(true);

  // Verify it contains a package path (dots separated)
  expect(
    exceptionField.includes("."),
    `Expected dotted package path in exception field, got: "${exceptionField}"`,
  ).toBe(true);

  // Verify internal package structure is leaked (com.noveogroup.ttt or javax/org.springframework)
  const leaksPackage =
    exceptionField.includes("com.noveogroup") ||
    exceptionField.includes("org.springframework") ||
    exceptionField.includes("javax.");

  expect(
    leaksPackage,
    `Expected internal package name in exception field, got: "${exceptionField}"`,
  ).toBe(true);

  // Step 3: Verify response contains standard error fields
  expect(body.error, "Response should have 'error' field").toBeTruthy();
  expect(body.status, "Response should have 'status' field").toBeTruthy();
  expect(body.path, "Response should have 'path' field").toBeTruthy();
  expect(body.timestamp, "Response should have 'timestamp' field").toBeTruthy();
});
