import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc118Data } from "../data/VacationTc118Data";

test("vacation_tc118 - NPE on null pagination in availability-schedule @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc118Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET v1 availability-schedule WITHOUT pagination params
  // KNOWN BUG: NPE at PageableRequestDTOToBOConverter.java:33-34
  const v1Url = tttConfig.buildUrl(
    `${data.v1Endpoint}?officeId=${data.officeId}`,
  );
  const v1Response = await request.get(v1Url, { headers: authHeaders });

  const v1Artifact = testInfo.outputPath("step1-v1-no-pagination.json");
  let v1Body: unknown;
  try {
    v1Body = await v1Response.json();
  } catch {
    v1Body = { status: v1Response.status(), text: await v1Response.text() };
  }
  await writeFile(v1Artifact, JSON.stringify(v1Body, null, 2), "utf-8");
  await testInfo.attach("step1-v1-no-pagination", { path: v1Artifact, contentType: "application/json" });

  // Known bug: HTTP 500 due to NPE
  expect(
    v1Response.status(),
    "KNOWN BUG: v1 availability-schedule should return 500 when pagination is missing",
  ).toBe(500);

  // Step 2: GET v2 availability-schedule WITHOUT pagination params
  const v2Url = tttConfig.buildUrl(
    `${data.v2Endpoint}?officeId=${data.officeId}`,
  );
  const v2Response = await request.get(v2Url, { headers: authHeaders });

  const v2Artifact = testInfo.outputPath("step2-v2-no-pagination.json");
  let v2Body: unknown;
  try {
    v2Body = await v2Response.json();
  } catch {
    v2Body = { status: v2Response.status(), text: await v2Response.text() };
  }
  await writeFile(v2Artifact, JSON.stringify(v2Body, null, 2), "utf-8");
  await testInfo.attach("step2-v2-no-pagination", { path: v2Artifact, contentType: "application/json" });

  // Known bug: HTTP 500 due to same NPE
  expect(
    v2Response.status(),
    "KNOWN BUG: v2 availability-schedule should return 500 when pagination is missing",
  ).toBe(500);

  // Step 3: Verify workaround — WITH pagination AND from/to params should succeed
  const today = new Date().toISOString().slice(0, 10);
  const v1WorkaroundUrl = tttConfig.buildUrl(
    `${data.v1Endpoint}?officeId=${data.officeId}&${data.workaroundParams}&from=${today}&to=${today}`,
  );
  const v1WorkaroundResponse = await request.get(v1WorkaroundUrl, {
    headers: authHeaders,
  });

  const v1WaArtifact = testInfo.outputPath("step3-v1-with-pagination.json");
  let v1WaBody: unknown;
  try {
    v1WaBody = await v1WorkaroundResponse.json();
  } catch {
    v1WaBody = { status: v1WorkaroundResponse.status() };
  }
  await writeFile(v1WaArtifact, JSON.stringify(v1WaBody, null, 2), "utf-8");
  await testInfo.attach("step3-v1-with-pagination", { path: v1WaArtifact, contentType: "application/json" });

  expect(
    v1WorkaroundResponse.status(),
    "v1 with pagination params should succeed",
  ).toBe(200);
});
