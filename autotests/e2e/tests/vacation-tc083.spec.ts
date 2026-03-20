import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc083Data } from "../data/VacationTc083Data";

test("vacation_tc083 - Available days: negative newDays accepted without error (known bug) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc083Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: Call with positive newDays (baseline — should always work)
  const positiveUrl = data.buildUrl(baseUrl, data.positiveNewDays);
  const positiveResponse = await request.get(positiveUrl, { headers: authHeaders });

  const positiveBody = await positiveResponse.json();
  const positiveArtifact = testInfo.outputPath("step1-positive-newdays.json");
  await writeFile(positiveArtifact, JSON.stringify({
    newDays: data.positiveNewDays,
    status: positiveResponse.status(),
    body: positiveBody,
  }, null, 2), "utf-8");
  await testInfo.attach("step1-positive-newdays", { path: positiveArtifact, contentType: "application/json" });

  expect(positiveResponse.status(), "Positive newDays should return 200").toBe(200);
  expect(positiveBody.availablePaidDays, "Positive newDays should return numeric value").not.toBeUndefined();

  // Step 2: Call with zero newDays (binary search "main page" mode)
  const zeroUrl = data.buildUrl(baseUrl, data.zeroNewDays);
  const zeroResponse = await request.get(zeroUrl, { headers: authHeaders });

  const zeroBody = await zeroResponse.json();
  const zeroArtifact = testInfo.outputPath("step2-zero-newdays.json");
  await writeFile(zeroArtifact, JSON.stringify({
    newDays: data.zeroNewDays,
    status: zeroResponse.status(),
    body: zeroBody,
  }, null, 2), "utf-8");
  await testInfo.attach("step2-zero-newdays", { path: zeroArtifact, contentType: "application/json" });

  expect(zeroResponse.status(), "Zero newDays should return 200").toBe(200);
  expect(zeroBody.availablePaidDays, "Zero newDays should return numeric value").not.toBeUndefined();

  // Step 3: Call with negative newDays — BUG: should reject but returns valid response
  const negativeUrl = data.buildUrl(baseUrl, data.negativeNewDays);
  const negativeResponse = await request.get(negativeUrl, { headers: authHeaders });

  let negativeBody: Record<string, unknown> = {};
  try { negativeBody = await negativeResponse.json(); } catch { /* may not be JSON */ }

  const negativeArtifact = testInfo.outputPath("step3-negative-newdays.json");
  await writeFile(negativeArtifact, JSON.stringify({
    newDays: data.negativeNewDays,
    status: negativeResponse.status(),
    body: negativeBody,
    bug: "Missing @Min validation on newDays parameter — negative values accepted",
  }, null, 2), "utf-8");
  await testInfo.attach("step3-negative-newdays", { path: negativeArtifact, contentType: "application/json" });

  // BUG: API returns 200 with valid availablePaidDays for negative newDays
  // Expected behavior: should return 400 (negative values invalid)
  // Actual behavior: returns 200 with inflated availablePaidDays
  expect(negativeResponse.status(), "BUG: Negative newDays returns 200 instead of 400").toBe(200);
  expect(
    negativeBody.availablePaidDays,
    "BUG: Negative newDays returns valid availablePaidDays",
  ).not.toBeUndefined();

  // Step 4: Compare positive vs negative — negative may inflate available days
  const positiveDays = positiveBody.availablePaidDays as number;
  const negativeDays = negativeBody.availablePaidDays as number;

  const comparisonArtifact = testInfo.outputPath("step4-comparison.json");
  await writeFile(comparisonArtifact, JSON.stringify({
    positiveNewDays: data.positiveNewDays,
    positiveResult: positiveDays,
    negativeNewDays: data.negativeNewDays,
    negativeResult: negativeDays,
    difference: negativeDays - positiveDays,
    inflated: negativeDays > positiveDays,
    bug: "Missing @Min validation — negative newDays accepted without error",
  }, null, 2), "utf-8");
  await testInfo.attach("step4-comparison", { path: comparisonArtifact, contentType: "application/json" });

  // BUG confirmed: negative newDays returns a valid numeric result (should have been rejected)
  expect(negativeDays, "BUG: Negative newDays returns valid availablePaidDays").toBeGreaterThanOrEqual(0);
});
