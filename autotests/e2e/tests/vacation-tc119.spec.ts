import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc119Data } from "../data/VacationTc119Data";

test("vacation_tc119 - malformed JSON request body returns empty 400 @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc119Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST malformed JSON to vacation create endpoint
  const response = await request.post(url, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.malformedJson,
  });

  const responseStatus = response.status();
  let bodyText = "";
  try { bodyText = await response.text(); } catch { /* empty */ }

  const artifact = testInfo.outputPath("step1-malformed-json.json");
  await writeFile(artifact, JSON.stringify({
    status: responseStatus,
    bodyLength: bodyText.length,
    body: bodyText || "(empty)",
  }, null, 2), "utf-8");
  await testInfo.attach("step1-malformed-json", { path: artifact, contentType: "application/json" });

  // Expect HTTP 400 (HttpMessageNotReadableException)
  expect(responseStatus, `Expected 400 for malformed JSON, got ${responseStatus}`).toBe(400);

  // Step 2: Verify body is EMPTY — HttpMessageNotReadableException handler returns ResponseEntity<Void>
  // The body should be empty or contain no actionable error information
  const step2Artifact = testInfo.outputPath("step2-empty-body-check.json");
  await writeFile(step2Artifact, JSON.stringify({
    bodyText,
    bodyLength: bodyText.length,
    isEmpty: bodyText.length === 0,
    isEmptyJson: bodyText === "" || bodyText === "{}",
  }, null, 2), "utf-8");
  await testInfo.attach("step2-empty-body-check", { path: step2Artifact, contentType: "application/json" });

  // Body should be empty (no error details, no errorCode, no message)
  expect(
    bodyText.length === 0 || bodyText === "{}",
    `Expected empty body for HttpMessageNotReadableException, got: "${bodyText.slice(0, 200)}"`,
  ).toBe(true);
});
