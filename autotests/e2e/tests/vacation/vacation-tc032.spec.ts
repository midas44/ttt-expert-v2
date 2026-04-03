import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc032Data } from "../../data/vacation/VacationTc032Data";

/**
 * TC-VAC-032: Auto-pay expired APPROVED vacations (cron).
 * Verifies the test endpoint POST /api/vacation/v1/test/vacations/pay-expired-approved
 * is accessible and returns 200. On qa-1 with no expired APPROVED vacations,
 * this is a smoke test. Full verification (creating past-date approved vacations
 * and confirming payment) requires timemachine env with clock manipulation.
 */
test("TC-VAC-032: Auto-pay expired APPROVED vacations (cron) @regress @vacation", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc032Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  // Step 1: Call the auto-pay cron endpoint
  const resp = await request.post(data.payExpiredUrl, {
    headers: {
      API_SECRET_TOKEN: data.apiToken,
      "Content-Type": "application/json",
    },
  });

  // Step 2: Verify endpoint returns 200 (processes any expired APPROVED vacations)
  expect(resp.status()).toBe(200);

  // Step 3: Verify response body is not an error
  const body = await resp.text();
  // Empty body or valid JSON — either is acceptable (no expired vacations = empty)
  if (body.length > 0) {
    // If there's a body, ensure it's not an error response
    try {
      const json = JSON.parse(body);
      expect(json.error).toBeUndefined();
      expect(json.errorCode).toBeUndefined();
    } catch {
      // Plain text response is OK (some endpoints return empty string)
    }
  }
});
