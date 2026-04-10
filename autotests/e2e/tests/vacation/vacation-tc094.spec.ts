import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc094Data } from "../../data/vacation/VacationTc094Data";

/**
 * TC-VAC-094: Exception class leakage in error responses.
 * POST /api/vacation/v1/vacations with past startDate to trigger 400.
 * Verifies that the 'exception' field in the error response contains the
 * full Java class name (com.noveogroup.ttt.common.exception.ServiceException),
 * which is an information disclosure vulnerability.
 */
test("TC-VAC-094: Error response leaks Java exception class name @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc094Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  // Step 1: POST vacation with past startDate to trigger error
  const resp = await request.post(data.vacationsUrl, {
    headers,
    data: {
      login: data.login,
      startDate: data.pastStartDate,
      endDate: data.pastEndDate,
      paymentType: "REGULAR",
      paymentMonth: "2020-01-01",
      optionalApprovers: [],
      notifyAlso: [],
    },
  });

  // Step 2: Verify HTTP 400
  expect(resp.status(), "Expected 400 for past dates").toBe(400);

  // Step 3: Check error response for 'exception' field
  const body = await resp.json();

  // Step 4: Verify 'exception' field contains full Java class name
  // This is the information disclosure: internal class name leaked to client
  // Could be com.noveogroup.ttt.*.ServiceException or org.springframework.*.Exception
  expect(
    body.exception,
    "Error response should contain 'exception' field (information disclosure)",
  ).toBeDefined();

  expect(
    body.exception,
    "Exception field should contain a fully qualified Java class name",
  ).toMatch(/^[a-z]+(\.[a-z]+)+\.[A-Z]\w+$/);
});
