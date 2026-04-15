import { test, expect } from "@playwright/test";
import { TttConfig } from "@ttt/config/tttConfig";
import { GlobalConfig } from "@common/config/globalConfig";
import { VacationTc091Data } from "../../data/vacation/VacationTc091Data";

/**
 * TC-VAC-091: Empty request body → empty 400 response.
 * HttpMessageNotReadableException returns ResponseEntity<Void> (completely empty body).
 * This is a design issue — should return structured error response.
 */
test("TC-VAC-091: Empty request body → empty 400 response @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc091Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  // Step 1: POST with completely empty body (no JSON content)
  const resp = await request.post(data.apiUrl, {
    headers,
  });

  // Step 2: Verify HTTP 400 status
  expect(resp.status(), "Expected 400 for empty request body").toBe(400);

  // Step 3: Verify response body is EMPTY (HttpMessageNotReadableException → ResponseEntity<Void>)
  const bodyText = await resp.text();
  expect(
    bodyText.trim().length,
    "Response body should be empty (no JSON error details)",
  ).toBe(0);
});
