import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc092Data } from "../../data/vacation/VacationTc092Data";

/**
 * TC-VAC-092: Invalid type parameter → type mismatch error.
 * GET /api/vacation/v1/vacations/abc — string where Long is expected.
 * Should return 400 with errorCode "exception.type.mismatch".
 */
test("TC-VAC-092: Invalid type parameter returns 400 type mismatch @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc092Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
  };

  // Step 1: GET with string "abc" instead of Long vacation ID
  const resp = await request.get(data.invalidIdUrl, { headers });

  // Step 2: Verify HTTP 400
  expect(resp.status(), "Expected 400 for invalid type parameter").toBe(400);

  // Step 3: Verify error response structure
  const body = await resp.json();

  expect(
    body.errorCode,
    "Expected errorCode 'exception.type.mismatch'",
  ).toBe("exception.type.mismatch");

  // Step 4: Verify message mentions expected type
  expect(
    body.message,
    "Error message should mention the expected type",
  ).toBeTruthy();
});
