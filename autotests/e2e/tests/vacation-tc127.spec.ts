import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc127Data } from "../data/VacationTc127Data";

test("vacation_tc127 - empty request body returns 400 @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc127Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: POST with completely empty body (Content-Type: application/json but no data)
  const response = await request.post(url, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: "",
  });

  const responseStatus = response.status();
  let bodyText = "";
  try { bodyText = await response.text(); } catch { /* empty */ }

  const step1Artifact = testInfo.outputPath("step1-empty-body-request.json");
  await writeFile(step1Artifact, JSON.stringify({
    status: responseStatus,
    bodyLength: bodyText.length,
    body: bodyText || "(empty)",
  }, null, 2), "utf-8");
  await testInfo.attach("step1-empty-body-request", { path: step1Artifact, contentType: "application/json" });

  // Expect HTTP 400 (HttpMessageNotReadableException)
  expect(responseStatus, `Expected 400 for empty body, got ${responseStatus}`).toBe(400);

  // Step 2: Verify body is EMPTY — same behavior as malformed JSON (TC-119)
  // HttpMessageNotReadableException handler returns ResponseEntity<Void>
  const step2Artifact = testInfo.outputPath("step2-empty-body-verification.json");
  await writeFile(step2Artifact, JSON.stringify({
    bodyText,
    bodyLength: bodyText.length,
    isEmpty: bodyText.length === 0,
    isEmptyJson: bodyText === "" || bodyText === "{}",
    sameAsTc119: "HttpMessageNotReadableException returns empty body for both malformed JSON and empty body",
  }, null, 2), "utf-8");
  await testInfo.attach("step2-empty-body-verification", { path: step2Artifact, contentType: "application/json" });

  // Body should be empty (no error details, no errorCode, no message)
  expect(
    bodyText.length === 0 || bodyText === "{}",
    `Expected empty body for HttpMessageNotReadableException, got: "${bodyText.slice(0, 200)}"`,
  ).toBe(true);

  // Step 3: Also try POST with Content-Type but null/undefined body
  const response2 = await request.post(url, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
  });

  const response2Status = response2.status();
  let body2Text = "";
  try { body2Text = await response2.text(); } catch { /* empty */ }

  const step3Artifact = testInfo.outputPath("step3-no-body-request.json");
  await writeFile(step3Artifact, JSON.stringify({
    status: response2Status,
    bodyLength: body2Text.length,
    body: body2Text || "(empty)",
    isEmpty: body2Text.length === 0,
  }, null, 2), "utf-8");
  await testInfo.attach("step3-no-body-request", { path: step3Artifact, contentType: "application/json" });

  // Should also return 400
  expect(response2Status, `Expected 400 for no-body request, got ${response2Status}`).toBe(400);
});
