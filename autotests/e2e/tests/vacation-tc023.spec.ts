import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc023Data } from "../data/VacationTc023Data";

test("TC-VAC-023: Create vacation with invalid notifyAlso login @regress", async ({
  request,
}, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc023Data.create(
    globalConfig.testDataMode,
    tttConfig,
  );
  const apiToken = tttConfig.apiToken;

  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const headers = {
    [data.authHeaderName]: apiToken,
    "Content-Type": "application/json",
  };

  // Step 1: Attempt create with mixed valid/invalid notifyAlso logins
  const body = {
    login: data.login,
    startDate: data.startDate,
    endDate: data.endDate,
    paymentType: data.paymentType,
    paymentMonth: data.paymentMonth,
    optionalApprovers: [],
    notifyAlso: [data.validColleagueLogin, data.invalidLogin],
  };

  const createResponse = await request.post(baseUrl, { headers, data: body });

  let createJson: Record<string, unknown> = {};
  try {
    createJson = await createResponse.json();
  } catch {
    createJson = { rawStatus: createResponse.status() };
  }

  const createArtifact = testInfo.outputPath("step1-create-attempt.json");
  await writeFile(
    createArtifact,
    JSON.stringify(
      { request: body, response: createJson, status: createResponse.status() },
      null,
      2,
    ),
    "utf-8",
  );
  await testInfo.attach("step1-create-attempt", {
    path: createArtifact,
    contentType: "application/json",
  });

  // Step 2: Verify rejection — HTTP 400
  expect(
    createResponse.status(),
    "Create with invalid notifyAlso login should return 400",
  ).toBe(400);

  // No cleanup needed — vacation was not created
});
