import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc082Data } from "../data/VacationTc082Data";

test("vacation_tc082 - Available days endpoint with newDays=0 (main page mode) @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc082Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(`${data.availableDaysEndpoint}?${data.buildQueryString()}`);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET available days with newDays=0 (binary search / main page mode)
  const response = await request.get(url, { headers: authHeaders });

  const body = await response.json();
  const artifact = testInfo.outputPath("step1-available-days.json");
  await writeFile(artifact, JSON.stringify(body, null, 2), "utf-8");
  await testInfo.attach("step1-available-days", { path: artifact, contentType: "application/json" });

  expect(response.status(), "Available days endpoint should return 200").toBe(200);

  // Step 2: Verify response structure — newDays=0 triggers binary search mode
  const structureArtifact = testInfo.outputPath("step2-structure-check.json");
  await writeFile(structureArtifact, JSON.stringify({
    hasAvailablePaidDays: "availablePaidDays" in body,
    availablePaidDays: body.availablePaidDays,
    availablePaidDaysType: typeof body.availablePaidDays,
    hasDaysNotEnough: "daysNotEnough" in body,
    daysNotEnoughLength: Array.isArray(body.daysNotEnough) ? body.daysNotEnough.length : "not array",
    allKeys: Object.keys(body),
  }, null, 2), "utf-8");
  await testInfo.attach("step2-structure-check", { path: structureArtifact, contentType: "application/json" });

  // availablePaidDays must be present and numeric (>= 0)
  expect(
    body.availablePaidDays !== undefined && body.availablePaidDays !== null,
    "Response must include availablePaidDays field",
  ).toBe(true);
  expect(
    typeof body.availablePaidDays === "number",
    `availablePaidDays should be a number, got ${typeof body.availablePaidDays}`,
  ).toBe(true);
  expect(
    body.availablePaidDays >= 0,
    `availablePaidDays should be >= 0, got ${body.availablePaidDays}`,
  ).toBe(true);

  // daysNotEnough should be an array (possibly empty)
  if ("daysNotEnough" in body) {
    expect(
      Array.isArray(body.daysNotEnough),
      "daysNotEnough should be an array",
    ).toBe(true);
  }
});
