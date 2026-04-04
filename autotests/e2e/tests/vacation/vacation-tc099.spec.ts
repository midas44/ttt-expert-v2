import { test, expect } from "@playwright/test";
import { TttConfig } from "../../config/tttConfig";
import { GlobalConfig } from "../../config/globalConfig";
import { VacationTc099Data } from "../../data/vacation/VacationTc099Data";

/**
 * TC-VAC-099: Invalid notifyAlso login → 400.
 * POST /api/vacation/v1/vacations with notifyAlso: ['nonexistent_user_xyz'].
 * @EmployeeLoginCollectionExists annotation validates all logins exist.
 * Should return 400 with validation error for notifyAlso field.
 */
test("TC-VAC-099: Invalid notifyAlso login returns 400 validation error @regress @vacation @api", async ({
  request,
}) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc099Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );

  const headers = {
    API_SECRET_TOKEN: tttConfig.apiToken,
    "Content-Type": "application/json",
  };

  // Step 1: POST vacation with invalid notifyAlso login
  const resp = await request.post(data.vacationsUrl, {
    headers,
    data: {
      login: data.login,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentType: "REGULAR",
      paymentMonth: data.paymentMonth,
      optionalApprovers: [],
      notifyAlso: ["nonexistent_user_xyz"],
    },
  });

  // Step 2: Verify HTTP 400
  expect(resp.status(), "Expected 400 for invalid notifyAlso login").toBe(400);

  // Step 3: Verify validation error in response
  const body = await resp.json();

  // The response should contain errors array or an error about notifyAlso
  const bodyStr = JSON.stringify(body).toLowerCase();
  expect(
    bodyStr.includes("notifyalso") ||
      bodyStr.includes("notify") ||
      bodyStr.includes("login") ||
      bodyStr.includes("exist"),
    `Error should reference notifyAlso or login validation. Got: ${JSON.stringify(body)}`,
  ).toBe(true);
});
