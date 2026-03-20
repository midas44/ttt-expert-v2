import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc120Data } from "../data/VacationTc120Data";

test("vacation_tc120 - invalid date format leaks stack trace info @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc120Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(data.paymentDatesEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET paymentdates with invalid date (month=13)
  const response = await request.get(url, { headers: authHeaders });

  const responseStatus = response.status();
  let body: Record<string, unknown> = {};
  try { body = await response.json(); } catch { /* non-JSON */ }

  const artifact = testInfo.outputPath("step1-invalid-date.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body }, null, 2), "utf-8");
  await testInfo.attach("step1-invalid-date", { path: artifact, contentType: "application/json" });

  // Expect HTTP 400 (MethodArgumentTypeMismatchException or similar conversion error)
  expect(responseStatus, `Expected 400 for invalid date, got ${responseStatus}`).toBe(400);

  // Step 2: Verify information disclosure — exception field contains Java class name
  const step2Artifact = testInfo.outputPath("step2-info-disclosure.json");
  const exceptionField = String(body.exception ?? "");
  const messageField = String(body.message ?? "");
  const errorField = String(body.error ?? "");

  await writeFile(step2Artifact, JSON.stringify({
    exception: exceptionField,
    message: messageField,
    error: errorField,
    hasJavaClassName: exceptionField.includes(".") && exceptionField.includes("Exception"),
    hasConversionError: messageField.toLowerCase().includes("convert") || messageField.toLowerCase().includes("parse"),
  }, null, 2), "utf-8");
  await testInfo.attach("step2-info-disclosure", { path: step2Artifact, contentType: "application/json" });

  // BUG VERIFICATION: exception field should contain full Java class name (info disclosure)
  // e.g. "org.springframework.web.method.annotation.MethodArgumentTypeMismatchException"
  const leaksClassName = exceptionField.includes(".") && exceptionField.includes("Exception");
  expect(
    leaksClassName,
    `Expected Java class name in exception field (info disclosure bug), got: "${exceptionField}"`,
  ).toBe(true);

  // Verify conversion/parse error details are exposed
  const exposesInternals =
    messageField.toLowerCase().includes("convert") ||
    messageField.toLowerCase().includes("parse") ||
    messageField.toLowerCase().includes("failed") ||
    messageField.includes("LocalDate");

  expect(
    exposesInternals,
    `Expected internal conversion error details in message, got: "${messageField.slice(0, 200)}"`,
  ).toBe(true);
});
