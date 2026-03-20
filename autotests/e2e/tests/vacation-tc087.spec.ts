import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc087Data } from "../data/VacationTc087Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc087 - Days by years endpoint returns per-year breakdown @regress", async ({ request }, testInfo) => {
  // 1. Config and data
  const tttConfig = new TttConfig();
  const data = new VacationTc087Data();

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const url = tttConfig.buildUrl(data.buildEndpointPath());
  const authHeaders = { [data.authHeaderName]: apiToken };

  // Step 1: GET vacation days grouped by years
  const response = await request.get(url, { headers: authHeaders });

  const body = await response.json();
  const artifact = testInfo.outputPath("step1-days-by-years.json");
  await writeFile(artifact, JSON.stringify(body, null, 2), "utf-8");
  await testInfo.attach("step1-days-by-years", { path: artifact, contentType: "application/json" });

  expect(response.status(), "Days by years endpoint should return 200").toBe(200);

  // Step 2: Verify response is an array of year/days objects
  expect(Array.isArray(body), "Response should be an array").toBe(true);
  expect(body.length, "Should have at least one year entry").toBeGreaterThan(0);

  const structureArtifact = testInfo.outputPath("step2-structure.json");
  await writeFile(structureArtifact, JSON.stringify({
    isArray: Array.isArray(body),
    length: body.length,
    firstEntry: body[0],
    allKeys: body.length > 0 ? Object.keys(body[0]) : [],
  }, null, 2), "utf-8");
  await testInfo.attach("step2-structure", { path: structureArtifact, contentType: "application/json" });

  // Each entry should have year (number) and days (number)
  for (const entry of body) {
    expect(entry.year, "Entry should have 'year' field").toBeDefined();
    expect(typeof entry.year === "number", `year should be a number, got ${typeof entry.year}`).toBe(true);
    expect(entry.days !== undefined && entry.days !== null, "Entry should have 'days' field").toBe(true);
    expect(typeof entry.days === "number", `days should be a number, got ${typeof entry.days}`).toBe(true);
  }

  // Step 3: Cross-check with DB — employee_vacation table
  const db = new DbClient(tttConfig);
  try {
    const dbRows = await db.query(
      `SELECT ev.year, ev.available_vacation_days AS days
       FROM ttt_vacation.employee_vacation ev
       JOIN ttt_vacation.employee e ON ev.employee = e.id
       WHERE e.login = $1
       ORDER BY ev.year`,
      [data.employeeLogin],
    );

    const dbArtifact = testInfo.outputPath("step3-db-cross-check.json");
    await writeFile(dbArtifact, JSON.stringify({
      apiEntries: body.length,
      dbEntries: dbRows.length,
      apiYears: body.map((e: Record<string, unknown>) => e.year).sort(),
      dbYears: dbRows.map((r: Record<string, unknown>) => r.year).sort(),
      dbRows,
    }, null, 2), "utf-8");
    await testInfo.attach("step3-db-cross-check", { path: dbArtifact, contentType: "application/json" });

    // API may filter out years with 0 balance — verify each API year exists in DB
    const dbYearMap = new Map(
      dbRows.map((r: Record<string, unknown>) => [Number(r.year), Number(r.days)]),
    );

    for (const apiEntry of body) {
      const year = Number(apiEntry.year);
      expect(
        dbYearMap.has(year),
        `API year ${year} should exist in DB`,
      ).toBe(true);

      // Days should match (allow small floating-point difference)
      const dbDays = dbYearMap.get(year)!;
      const apiDays = Number(apiEntry.days);
      const diff = Math.abs(apiDays - dbDays);
      expect(
        diff < 0.01,
        `Days for year ${year}: API=${apiDays}, DB=${dbDays}, diff=${diff}`,
      ).toBe(true);
    }
  } finally {
    await db.close();
  }
});
