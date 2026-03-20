import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc016Data } from "../data/VacationTc016Data";

test("vacation_tc016 - create with non-existent employee login @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc016Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST create vacation with non-existent login
  // @EmployeeLoginExists annotation on DTO.login field should trigger validation error
  const createResponse = await request.post(baseUrl, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildCreateBody(),
  });

  const responseStatus = createResponse.status();
  let responseBody: Record<string, unknown> = {};
  try {
    responseBody = await createResponse.json();
  } catch {
    // Non-JSON response
  }

  const artifact = testInfo.outputPath("step1-create-nonexistent-login.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body: responseBody }, null, 2), "utf-8");
  await testInfo.attach("step1-create-nonexistent-login", { path: artifact, contentType: "application/json" });

  // Step 2: Verify — should be 400 with login validation error
  expect(responseStatus, `Expected 400, got ${responseStatus}`).toBe(400);

  // Check for login-related validation error
  const errorCode = (responseBody.errorCode as string) ?? "";
  const errors = (responseBody.errors ?? []) as Array<{ field?: string; code?: string }>;

  const hasLoginError =
    errorCode.toLowerCase().includes("login") ||
    errors.some(
      (e) =>
        e.field === "login" ||
        e.code?.toLowerCase().includes("login") ||
        e.code?.toLowerCase().includes("employee"),
    );

  expect(
    hasLoginError,
    `Expected login validation error (EmployeeLoginExists), got: ${JSON.stringify(responseBody)}`,
  ).toBe(true);

  // Verify the error references the login field specifically
  if (errors.length > 0) {
    const loginErr = errors.find(
      (e) =>
        e.field === "login" ||
        e.code?.toLowerCase().includes("login") ||
        e.code?.toLowerCase().includes("employee"),
    );
    if (loginErr) {
      expect(loginErr.field, "Error should reference the login field").toBe("login");
    }
  }
});
