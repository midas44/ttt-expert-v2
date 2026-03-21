import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc010Data } from "../data/VacationTc010Data";

test("TC-VAC-010: Create with insufficient available days (AV=true) — 400 @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc010Data.create(globalConfig.testDataMode, tttConfig);
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = { [data.authHeaderName]: apiToken, "Content-Type": "application/json" };

  // Log available days for diagnostics
  const diagArtifact = testInfo.outputPath("step0-available-days.json");
  await writeFile(diagArtifact, JSON.stringify({
    login: data.login,
    availableDays: data.availableDays,
    startDate: data.startDate,
    endDate: data.endDate,
    note: "Vacation duration exceeds available paid days — should trigger validation.vacation.duration",
  }, null, 2), "utf-8");
  await testInfo.attach("step0-available-days", { path: diagArtifact, contentType: "application/json" });

  // Step 1: POST with oversized vacation
  const createBody = {
    login: data.login,
    startDate: data.startDate,
    endDate: data.endDate,
    paymentType: data.paymentType,
    paymentMonth: data.paymentMonth,
    optionalApprovers: [],
    notifyAlso: [],
  };

  const response = await request.post(baseUrl, {
    headers,
    data: createBody,
  });

  const responseJson = await response.json();
  const artifact = testInfo.outputPath("step1-insufficient-days-error.json");
  await writeFile(artifact, JSON.stringify({ request: createBody, response: responseJson, status: response.status() }, null, 2), "utf-8");
  await testInfo.attach("step1-insufficient-days-error", { path: artifact, contentType: "application/json" });

  // Step 2: Verify HTTP 400
  expect(response.status()).toBe(data.expectedHttpStatus);

  // Step 3: Verify error code — validation.vacation.duration covers both
  // "insufficient days" and "min duration" cases
  const errors: Array<{ field?: string; code?: string; message?: string }> = responseJson.errors ?? [];
  const durationError = errors.find((e) => e.code === data.expectedErrorCode);
  expect(durationError, `Expected error code "${data.expectedErrorCode}" in errors[], got: ${JSON.stringify(errors)}`).toBeTruthy();

  // No cleanup needed — vacation was not created
});
