import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc004Data } from "../data/VacationTc004Data";

test("vacation_tc004 - create vacation with start date in past rejected @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc004Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST create vacation with startDate = yesterday
  const response = await request.post(baseUrl, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildCreateBody(),
  });

  const responseArtifact = testInfo.outputPath("step1-error-response.json");
  const body = await response.json();
  await writeFile(responseArtifact, JSON.stringify(body, null, 2), "utf-8");
  await testInfo.attach("step1-error-response", { path: responseArtifact, contentType: "application/json" });

  // Step 2: Verify error response
  expect(response.status(), `Expected ${data.expectedStatus}, got ${response.status()}`).toBe(data.expectedStatus);

  // The error should contain the past-date validation error code
  const hasExpectedError =
    body.errorCode === data.expectedErrorCode ||
    (Array.isArray(body.errors) &&
      body.errors.some(
        (e: { code?: string }) => e.code === data.expectedErrorCode,
      ));

  expect(
    hasExpectedError,
    `Expected errorCode "${data.expectedErrorCode}" in response: ${JSON.stringify(body)}`,
  ).toBeTruthy();
});
