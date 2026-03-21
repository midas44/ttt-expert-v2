import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc016Data } from "../data/VacationTc016Data";

test("TC-VAC-016: Create with non-existent employee login — 400 @regress", async ({
  request,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc016Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = {
    [data.authHeaderName]: apiToken,
    "Content-Type": "application/json",
  };

  // POST with a login that does not exist in the employee table
  const body = {
    login: data.login,
    startDate: data.startDate,
    endDate: data.endDate,
    paymentType: data.paymentType,
    paymentMonth: data.paymentMonth,
    optionalApprovers: [],
    notifyAlso: [],
  };

  const response = await request.post(baseUrl, { headers, data: body });
  const responseJson = await response.json();

  const artifact = testInfo.outputPath("step1-nonexistent-login.json");
  await writeFile(
    artifact,
    JSON.stringify(
      { request: body, response: responseJson, status: response.status() },
      null,
      2,
    ),
    "utf-8",
  );
  await testInfo.attach("step1-nonexistent-login", {
    path: artifact,
    contentType: "application/json",
  });

  // Verify HTTP 400
  expect(response.status()).toBe(data.expectedHttpStatus);

  // Verify validation error for login field (@EmployeeLoginExists annotation)
  const errors: Array<{ field?: string; code?: string; message?: string }> =
    responseJson.errors ?? [];
  const loginError = errors.find((e) => e.field === "login");
  expect(
    loginError,
    `Expected validation error for "login" field, got: ${JSON.stringify(errors)}`,
  ).toBeTruthy();

  // No cleanup needed — vacation was not created
});
