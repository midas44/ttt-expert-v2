import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc014Data } from "../data/VacationTc014Data";

test("TC-VAC-014: Create with null paymentMonth — NPE bug @regress @known-bug", async ({
  request,
}, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc014Data.create(
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

  // POST without paymentMonth — triggers NPE at VacationAvailablePaidDaysCalculatorImpl:73
  const body = {
    login: data.login,
    startDate: data.startDate,
    endDate: data.endDate,
    paymentType: data.paymentType,
    // paymentMonth deliberately omitted — null in DTO
    optionalApprovers: [],
    notifyAlso: [],
  };

  const response = await request.post(baseUrl, { headers, data: body });

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = await response.text();
  }

  const bugStatus =
    response.status() === 500
      ? "BUG CONFIRMED: NPE — paymentDate.getYear() on null (missing @NotNull on DTO field)"
      : response.status() === 400
        ? "BUG FIXED: Server now returns 400 validation error for null paymentMonth"
        : `UNEXPECTED: status ${response.status()}`;

  const artifact = testInfo.outputPath("step1-null-payment-month.json");
  await writeFile(
    artifact,
    JSON.stringify(
      { request: body, response: responseBody, status: response.status(), note: bugStatus },
      null,
      2,
    ),
    "utf-8",
  );
  await testInfo.attach("step1-null-payment-month", {
    path: artifact,
    contentType: "application/json",
  });

  // Server must reject: either 500 (NPE bug) or 400 (fixed with proper validation)
  expect(
    response.status(),
    "Server must reject null paymentMonth (expected 400 or 500)",
  ).toBeGreaterThanOrEqual(400);

  // Known bug assertion: expect 500 specifically
  // If this changes to 400, the bug was fixed — update test accordingly
  expect(response.status(), bugStatus).toBe(500);

  // No cleanup needed — vacation was not created
});
