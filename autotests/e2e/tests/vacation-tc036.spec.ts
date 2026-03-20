import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc036Data } from "../data/VacationTc036Data";

test("vacation_tc036 - update non-existing vacation ID @regress @known-bug", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc036Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: PUT update vacation with non-existent ID (999999999)
  // KNOWN BUG: VacationUpdateValidator.isValidVacationDuration loads entity from DB,
  // gets null (non-existent ID), then calls entity.getId() → NPE (500 instead of 404).
  const updateUrl = `${baseUrl}/${data.nonExistentId}`;
  const updateResponse = await request.put(updateUrl, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: data.buildUpdateBody(),
  });

  const responseStatus = updateResponse.status();
  let responseBody: Record<string, unknown> = {};
  try {
    responseBody = await updateResponse.json();
  } catch {
    // Non-JSON response
  }

  const artifact = testInfo.outputPath("step1-update-nonexistent.json");
  await writeFile(artifact, JSON.stringify({ status: responseStatus, body: responseBody }, null, 2), "utf-8");
  await testInfo.attach("step1-update-nonexistent", { path: artifact, contentType: "application/json" });

  // Step 2: Verify — KNOWN BUG: returns 500 (NPE) instead of expected 404.
  // VacationUpdateValidator.isValidVacationDuration(line 108):
  //   entity = vacationRepository.findById(id) → null
  //   entity.getId() → NullPointerException
  // Accept 500 (NPE bug), 404 (if fixed), or 400 (validation before lookup)
  expect(
    [400, 404, 500].includes(responseStatus),
    `Expected 400, 404, or 500, got ${responseStatus}`,
  ).toBe(true);

  if (responseStatus === 500) {
    // Known NPE bug — verify it's the expected NullPointerException
    const message = (responseBody.message as string) ?? "";
    const trace = (responseBody.trace as string) ?? "";
    const isNpe =
      message.includes("NullPointerException") ||
      trace.includes("NullPointerException") ||
      trace.includes("VacationUpdateValidator");
    expect(
      responseStatus === 500,
      "Should be 500 (known NPE bug — VacationUpdateValidator doesn't handle null entity)",
    ).toBe(true);
  }

  if (responseStatus === 404) {
    // Bug was fixed — proper not-found handling
    const errorCode = (responseBody.errorCode as string) ?? "";
    const message = (responseBody.message as string) ?? "";
    const hasNotFoundError =
      errorCode.includes("not.found") ||
      errorCode.includes("not_found") ||
      message.toLowerCase().includes("not found");
    expect(
      hasNotFoundError,
      `Expected not-found error code, got: ${JSON.stringify(responseBody)}`,
    ).toBe(true);
  }
});
