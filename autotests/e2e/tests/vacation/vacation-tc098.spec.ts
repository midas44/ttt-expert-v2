import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc098Data } from "../../data/vacation/VacationTc098Data";

/**
 * TC-VAC-098: Non-existent vacation ID → error response.
 * GET /api/vacation/v1/vacations/999999999 — ID that does not exist.
 * Actual behavior: returns 400 (not 404) because @VacationIdExists annotation
 * validates the ID before the controller method runs. The validation layer
 * returns a ConstraintViolationException with errorCode "exception.validation".
 */
test("TC-VAC-098: Non-existent vacation ID returns 400 with VacationIdExistsValidator @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc098Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
  };

  // Step 1: GET non-existent vacation
  const resp = await request.get(data.nonExistentVacationUrl, { headers });

  // Step 2: Verify HTTP 400 (validation error, not 404)
  expect(resp.status(), "Expected 400 for non-existent vacation ID").toBe(400);

  // Step 3: Verify error response structure
  const body = await resp.json();
  expect(body.errorCode, "Expected errorCode 'exception.validation'").toBe(
    "exception.validation",
  );

  // Step 4: Verify errors array contains VacationIdExistsValidator
  expect(body.errors, "Response should contain errors array").toBeDefined();
  expect(Array.isArray(body.errors), "errors should be an array").toBe(true);

  const vacIdError = body.errors.find(
    (e: Record<string, string>) => e.code === "VacationIdExistsValidator",
  );
  expect(
    vacIdError,
    "Should have VacationIdExistsValidator error",
  ).toBeDefined();
  expect(vacIdError.message).toContain("not found");
});
