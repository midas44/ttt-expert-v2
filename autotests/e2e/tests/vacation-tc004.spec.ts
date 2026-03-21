import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc004Data } from "../data/VacationTc004Data";

test("TC-VAC-004: Create vacation with start date in past — 400 @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc004Data.create(globalConfig.testDataMode, tttConfig);
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = { [data.authHeaderName]: apiToken, "Content-Type": "application/json" };

  // Step 1: POST with startDate in the past
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
  const artifact = testInfo.outputPath("step1-past-date-error.json");
  await writeFile(artifact, JSON.stringify({ request: createBody, response: responseJson, status: response.status() }, null, 2), "utf-8");
  await testInfo.attach("step1-past-date-error", { path: artifact, contentType: "application/json" });

  // Step 2: Verify HTTP 400
  expect(response.status()).toBe(data.expectedHttpStatus);

  // Step 3: Verify error code in errors[] array (top-level errorCode is generic "exception.validation")
  const errors: Array<{ field?: string; code?: string; message?: string }> = responseJson.errors ?? [];
  const startDateError = errors.find((e) => e.code === data.expectedErrorCode);
  expect(startDateError, `Expected error code "${data.expectedErrorCode}" in errors[], got: ${JSON.stringify(errors)}`).toBeTruthy();
  expect(startDateError!.field).toBe("startDate");

  // No cleanup needed — vacation was not created
});
