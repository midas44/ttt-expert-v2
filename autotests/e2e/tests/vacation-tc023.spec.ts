import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc023Data } from "../data/VacationTc023Data";

test("vacation_tc023 - create vacation with invalid notifyAlso login @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc023Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST with notifyAlso containing a non-existent login
  const createResponse = await request.post(baseUrl, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildCreateBody(),
  });

  const createStatus = createResponse.status();
  let createBody: Record<string, unknown> = {};
  try {
    createBody = await createResponse.json();
  } catch {
    // Some error responses may not have a body
  }

  const artifact = testInfo.outputPath("step1-create-invalid-notify.json");
  await writeFile(artifact, JSON.stringify({ status: createStatus, body: createBody }, null, 2), "utf-8");
  await testInfo.attach("step1-create-invalid-notify", { path: artifact, contentType: "application/json" });

  // @EmployeeLoginCollectionExists validator should reject the invalid login
  expect(
    createStatus,
    `Expected 400 for invalid notifyAlso login, got ${createStatus}`,
  ).toBe(400);

  // Verify error indicates the validation failure
  const errorCode = (createBody as Record<string, unknown>).errorCode as string | undefined;
  const errors = (createBody as Record<string, unknown>).errors as Array<Record<string, unknown>> | undefined;

  // Error may appear in top-level errorCode or in nested errors array
  const hasValidationError =
    errorCode?.includes("validation") ||
    errors?.some((e) => String(e.code ?? "").includes("EmployeeLoginCollectionExists"));

  const errorArtifact = testInfo.outputPath("error-details.json");
  await writeFile(errorArtifact, JSON.stringify({
    errorCode,
    errors,
    hasValidationError,
    invalidLogin: data.invalidNotifyAlso,
  }, null, 2), "utf-8");
  await testInfo.attach("error-details", { path: errorArtifact, contentType: "application/json" });

  expect(hasValidationError, "Response should indicate a validation error for invalid login").toBe(true);
});
