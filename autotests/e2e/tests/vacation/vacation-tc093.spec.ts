import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc093Data } from "../../data/vacation/VacationTc093Data";

/**
 * TC-VAC-093: Missing required fields → validation errors array.
 * POST /api/vacation/v1/vacations with {} (empty JSON object).
 * Should return 400 with an errors[] array listing missing required fields.
 */
test("TC-VAC-093: Missing required fields return validation errors @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc093Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  // Step 1: POST with empty JSON object
  const resp = await request.post(data.vacationsUrl, {
    headers,
    data: {},
  });

  // Step 2: Verify HTTP 400
  expect(resp.status(), "Expected 400 for missing required fields").toBe(400);

  // Step 3: Verify response contains errors array
  const body = await resp.json();
  expect(body.errors, "Response should contain 'errors' array").toBeDefined();
  expect(
    Array.isArray(body.errors),
    "errors should be an array",
  ).toBe(true);
  expect(
    body.errors.length,
    "Should have multiple validation errors",
  ).toBeGreaterThanOrEqual(1);

  // Step 4: Verify each error has required structure: field, code, message
  for (const error of body.errors) {
    expect(error.field, "Each error should have 'field' property").toBeTruthy();
    expect(error.code, "Each error should have 'code' property").toBeTruthy();
    expect(error.message, "Each error should have 'message' property").toBeTruthy();
  }

  // Step 5: Verify expected required fields are reported
  const errorFields = body.errors.map((e: Record<string, string>) => e.field);
  const expectedFields = ["login", "startDate", "endDate", "paymentType"];

  for (const field of expectedFields) {
    expect(
      errorFields,
      `Expected validation error for required field '${field}'`,
    ).toContain(field);
  }
});
