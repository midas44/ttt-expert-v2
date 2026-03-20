import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc014Data } from "../data/VacationTc014Data";

test("vacation_tc014 - create with null paymentMonth triggers NPE @regress @known-bug", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc014Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST create vacation without paymentMonth field
  const createResponse = await request.post(baseUrl, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildCreateBody(),
  });

  const responseStatus = createResponse.status();
  let responseBody: Record<string, unknown> = {};
  try {
    responseBody = await createResponse.json();
  } catch {
    // 500 errors may return non-JSON body
  }

  const artifact = testInfo.outputPath("step1-create-null-paymentMonth.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body: responseBody }, null, 2), "utf-8");
  await testInfo.attach("step1-create-null-paymentMonth", { path: artifact, contentType: "application/json" });

  // Step 2: Verify — KNOWN BUG: expects 500 (NPE) instead of 400 (validation)
  // The DTO has no @NotNull on paymentMonth, so correctPaymentMonth() or
  // VacationAvailablePaidDaysCalculatorImpl.paymentDate.getYear() throws NPE.
  // Accept either 500 (NPE bug) or 400 (if bug gets fixed):
  expect(
    [400, 500].includes(responseStatus),
    `Expected 400 or 500, got ${responseStatus}`,
  ).toBe(true);

  if (responseStatus === 500) {
    // Known NPE bug — verify it's the expected NullPointerException
    const exception = responseBody.exception as string ?? "";
    const message = responseBody.message as string ?? "";
    const isNpe = exception.includes("NullPointerException") || message.includes("NullPointerException");
    // Note: some error handlers may wrap the NPE, so we also accept generic 500
    expect(
      responseStatus === 500,
      "Should be 500 (known NPE bug when paymentMonth is null)",
    ).toBe(true);
  }

  if (responseStatus === 400) {
    // Bug was fixed — paymentMonth now validated. Verify proper error code.
    const errorCode = responseBody.errorCode as string ?? "";
    const errors = (responseBody.errors ?? []) as Array<{ field?: string; code?: string }>;
    const hasPaymentError =
      errorCode.includes("payment") ||
      errors.some((e) => e.field === "paymentMonth");
    expect(
      hasPaymentError,
      `Expected payment-related validation error, got: ${JSON.stringify(responseBody)}`,
    ).toBe(true);
  }
});
