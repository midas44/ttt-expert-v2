import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc097Data } from "../data/VacationTc097Data";

test("vacation_tc097 - Payment dates endpoint returns valid 1st-of-month range @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc097Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(data.buildEndpointUrl());
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET payment dates
  const response = await request.get(url, { headers: authHeaders });

  const body = await response.json();
  const artifact = testInfo.outputPath("step1-payment-dates.json");
  await writeFile(artifact, JSON.stringify(body, null, 2), "utf-8");
  await testInfo.attach("step1-payment-dates", { path: artifact, contentType: "application/json" });

  expect(response.status(), "Payment dates endpoint should return 200").toBe(200);
  expect(Array.isArray(body), "Response should be an array").toBe(true);
  expect(body.length, "Should return at least one payment date").toBeGreaterThan(0);

  // Step 2: Verify all dates are 1st-of-month (YYYY-MM-01 format)
  const invalidDates: string[] = [];
  for (const dateStr of body) {
    expect(typeof dateStr === "string", `Each date should be a string, got ${typeof dateStr}`).toBe(true);
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    expect(match, `Date should match YYYY-MM-DD format: ${dateStr}`).toBeTruthy();
    if (match && match[3] !== "01") {
      invalidDates.push(String(dateStr));
    }
  }

  const structArtifact = testInfo.outputPath("step2-structure.json");
  await writeFile(structArtifact, JSON.stringify({
    totalDates: body.length,
    firstDate: body[0],
    lastDate: body[body.length - 1],
    allFirstOfMonth: invalidDates.length === 0,
    invalidDates,
  }, null, 2), "utf-8");
  await testInfo.attach("step2-structure", { path: structArtifact, contentType: "application/json" });

  expect(
    invalidDates.length,
    `All dates should be 1st of month. Invalid: ${invalidDates.join(", ")}`,
  ).toBe(0);

  // Step 3: Verify dates are consecutive months with no gaps
  const dates = body.map((d: string) => new Date(d));
  const gaps: string[] = [];
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1];
    const curr = dates[i];
    const monthDiff =
      (curr.getFullYear() - prev.getFullYear()) * 12 +
      curr.getMonth() - prev.getMonth();
    if (monthDiff !== 1) {
      gaps.push(`${body[i - 1]} → ${body[i]} (gap=${monthDiff})`);
    }
  }

  const rangeArtifact = testInfo.outputPath("step3-range-check.json");
  await writeFile(rangeArtifact, JSON.stringify({
    vacationStart: data.vacationStartDate,
    vacationEnd: data.vacationEndDate,
    returnedMin: body[0],
    returnedMax: body[body.length - 1],
    totalMonths: body.length,
    consecutive: gaps.length === 0,
    gaps,
  }, null, 2), "utf-8");
  await testInfo.attach("step3-range-check", { path: rangeArtifact, contentType: "application/json" });

  expect(gaps.length, `Dates should be consecutive months. Gaps: ${gaps.join("; ")}`).toBe(0);

  // Step 4: Verify range includes vacation start month
  const vacStartMonth = data.vacationStartDate.slice(0, 7) + "-01";
  expect(
    body.includes(vacStartMonth),
    `Range should include vacation start month ${vacStartMonth}`,
  ).toBe(true);
});
