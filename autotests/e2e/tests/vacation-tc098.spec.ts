import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc098Data } from "../data/VacationTc098Data";

test("vacation_tc098 - Payment dates with start > end accepted (known bug) @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc098Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET normal (valid) range as baseline
  const normalUrl = tttConfig.buildUrl(data.buildNormalUrl());
  const normalResponse = await request.get(normalUrl, { headers: authHeaders });

  const normalBody = await normalResponse.json();
  const normalArtifact = testInfo.outputPath("step1-normal-range.json");
  await writeFile(normalArtifact, JSON.stringify(normalBody, null, 2), "utf-8");
  await testInfo.attach("step1-normal-range", { path: normalArtifact, contentType: "application/json" });

  expect(normalResponse.status(), "Normal range should return 200").toBe(200);
  expect(Array.isArray(normalBody), "Normal response should be an array").toBe(true);
  expect(normalBody.length, "Normal range should return dates").toBeGreaterThan(0);

  // Step 2: GET inverted range (start > end) — should fail but doesn't
  const invertedUrl = tttConfig.buildUrl(data.buildInvertedUrl());
  const invertedResponse = await request.get(invertedUrl, { headers: authHeaders });

  const invertedBody = await invertedResponse.json();
  const invertedArtifact = testInfo.outputPath("step2-inverted-range.json");
  await writeFile(invertedArtifact, JSON.stringify(invertedBody, null, 2), "utf-8");
  await testInfo.attach("step2-inverted-range", { path: invertedArtifact, contentType: "application/json" });

  // BUG: API returns 200 with valid results for inverted range
  // Expected: HTTP 400 with validation error
  // Actual: HTTP 200 with date array (same as normal range)
  const bugArtifact = testInfo.outputPath("step3-bug-analysis.json");
  await writeFile(bugArtifact, JSON.stringify({
    bug: "Payment dates accepts start > end without validation",
    invertedStart: data.invertedStartDate,
    invertedEnd: data.invertedEndDate,
    expectedStatus: 400,
    actualStatus: invertedResponse.status(),
    invertedReturnsResults: Array.isArray(invertedBody) && invertedBody.length > 0,
    normalResultCount: normalBody.length,
    invertedResultCount: Array.isArray(invertedBody) ? invertedBody.length : "N/A",
  }, null, 2), "utf-8");
  await testInfo.attach("step3-bug-analysis", { path: bugArtifact, contentType: "application/json" });

  // Assert the known bug behavior: inverted range returns 200
  expect(invertedResponse.status(), "BUG: Inverted range returns 200 instead of 400").toBe(200);
  expect(Array.isArray(invertedBody), "BUG: Inverted range returns an array").toBe(true);
  expect(invertedBody.length, "BUG: Inverted range returns results").toBeGreaterThan(0);
});
