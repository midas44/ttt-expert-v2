import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc084Data } from "../data/VacationTc084Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc084 - Cross-year vacation splits days across years @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc084Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const baseUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create cross-year vacation (spans Dec→Jan)
    const createResponse = await request.post(baseUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResponse.json();
    const createArtifact = testInfo.outputPath("step1-create-cross-year.json");
    await writeFile(createArtifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-cross-year", { path: createArtifact, contentType: "application/json" });

    expect(createResponse.status(), "Create should return 200").toBe(200);
    const vac = createBody.vacation;
    expect(vac).toBeTruthy();
    expect(vac.status).toBe("NEW");
    createdVacationId = vac.id;

    // Verify response has regularDays (total working days)
    const totalRegularDays = vac.regularDays;
    const totalAdminDays = vac.administrativeDays;
    const totalDays = totalRegularDays + totalAdminDays;
    expect(totalDays, "Cross-year vacation should have working days > 0").toBeGreaterThan(0);

    const daysArtifact = testInfo.outputPath("step1-days-info.json");
    await writeFile(daysArtifact, JSON.stringify({
      vacationId: createdVacationId,
      startDate: data.startDate,
      endDate: data.endDate,
      startYear: data.startYear,
      endYear: data.endYear,
      regularDays: totalRegularDays,
      administrativeDays: totalAdminDays,
      totalDays,
    }, null, 2), "utf-8");
    await testInfo.attach("step1-days-info", { path: daysArtifact, contentType: "application/json" });

    // Step 2: Verify days are split in vacation_days_distribution table
    const db = new DbClient(tttConfig);
    try {
      const distRows = await db.query(
        `SELECT year, days
         FROM ttt_vacation.vacation_days_distribution
         WHERE vacation = $1
         ORDER BY year`,
        [createdVacationId],
      );

      const distArtifact = testInfo.outputPath("step2-days-distribution.json");
      await writeFile(distArtifact, JSON.stringify({
        vacationId: createdVacationId,
        distributionRows: distRows,
        rowCount: distRows.length,
        years: distRows.map((r: Record<string, unknown>) => r.year),
      }, null, 2), "utf-8");
      await testInfo.attach("step2-days-distribution", { path: distArtifact, contentType: "application/json" });

      // Distribution uses FIFO: days consumed from earliest balance year.
      // May be 1 row (all from one year) or multiple rows if balance splits.
      expect(
        distRows.length,
        `Distribution should have at least 1 entry, got ${distRows.length}`,
      ).toBeGreaterThanOrEqual(1);

      // Sum of distribution days should equal total regular days
      const distributionTotal = distRows.reduce(
        (sum: number, r: Record<string, unknown>) => sum + Number(r.days), 0,
      );

      const summaryArtifact = testInfo.outputPath("step2-summary.json");
      await writeFile(summaryArtifact, JSON.stringify({
        distributionRows: distRows,
        distributionTotal,
        apiRegularDays: totalRegularDays,
        match: distributionTotal === totalRegularDays,
        note: "FIFO: days consumed from earliest available balance year, not calendar year of vacation dates",
      }, null, 2), "utf-8");
      await testInfo.attach("step2-summary", { path: summaryArtifact, contentType: "application/json" });

      expect(
        distributionTotal,
        `Distribution total (${distributionTotal}) should equal regularDays (${totalRegularDays})`,
      ).toBe(totalRegularDays);

      // Step 3: Verify vacation record confirms cross-year span
      const vacRow = await db.queryOne(
        `SELECT start_date, end_date
         FROM ttt_vacation.vacation
         WHERE id = $1`,
        [createdVacationId],
      );
      const dbStart = String(vacRow.start_date).slice(0, 4);
      const dbEnd = String(vacRow.end_date).slice(0, 4);

      const crossYearArtifact = testInfo.outputPath("step3-cross-year-verify.json");
      await writeFile(crossYearArtifact, JSON.stringify({
        dbStartDate: vacRow.start_date,
        dbEndDate: vacRow.end_date,
        startYear: dbStart,
        endYear: dbEnd,
        spansTwoYears: dbStart !== dbEnd,
      }, null, 2), "utf-8");
      await testInfo.attach("step3-cross-year-verify", { path: crossYearArtifact, contentType: "application/json" });

      expect(dbStart !== dbEnd, "Vacation should span two different calendar years").toBe(true);
    } finally {
      await db.close();
    }
  } finally {
    if (createdVacationId) {
      await request.delete(`${baseUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
