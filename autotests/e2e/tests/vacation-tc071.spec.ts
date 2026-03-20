import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc071Data } from "../data/VacationTc071Data";

test("vacation_tc071 - AV=true: full year available immediately (not prorated) @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc071Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET available vacation days for AV=true employee
  const url = `${baseUrl}${data.buildQueryString()}`;
  const response = await request.get(url, { headers: authHeaders });

  const body = await response.json();
  const artifact = testInfo.outputPath("step1-available-days.json");
  await writeFile(artifact, JSON.stringify(body, null, 2), "utf-8");
  await testInfo.attach("step1-available-days", { path: artifact, contentType: "application/json" });

  expect(response.status(), `Expected 200, got ${response.status()}`).toBe(200);

  // Step 2: Verify response structure
  // Response should contain availablePaidDays (the key field for this test)
  const availablePaidDays = body.availablePaidDays;
  expect(availablePaidDays, "Response should contain availablePaidDays").not.toBeUndefined();

  const detailArtifact = testInfo.outputPath("step2-analysis.json");
  await writeFile(
    detailArtifact,
    JSON.stringify({
      availablePaidDays,
      annualNorm: data.annualNorm,
      monthlyProratedWouldBe: data.monthlyProratedAmount,
      paymentDate: data.paymentDate,
      login: data.login,
    }, null, 2),
    "utf-8",
  );
  await testInfo.attach("step2-analysis", { path: detailArtifact, contentType: "application/json" });

  // Step 3: Verify AV=true behavior — full year balance, not monthly proration.
  // For AV=true in March, if prorated: 3 * (24/12) = 6 days.
  // AV=true should show significantly more (up to 24 minus consumed).
  // We verify available > prorated as confirmation of advance vacation.
  // Note: if many vacations are already consumed, this check may need adjustment.
  expect(
    availablePaidDays,
    `AV=true: availablePaidDays (${availablePaidDays}) should exceed monthly proration (${data.monthlyProratedAmount}). ` +
    `This confirms full-year balance, not monthly accrual.`,
  ).toBeGreaterThan(data.monthlyProratedAmount);
});
