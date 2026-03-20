import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc165Data } from "../data/VacationTc165Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc165 - Edit multi-year vacation redistribution recalculates @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc165Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Create cross-year vacation (Dec 18 → Jan 5)
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResp.json();
    const step1Artifact = testInfo.outputPath("step1-create-cross-year.json");
    await writeFile(step1Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step1-create-cross-year", { path: step1Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create should return 200").toBe(200);
    const vac = createBody.vacation;
    expect(vac).toBeTruthy();
    createdVacationId = vac.id;

    const originalRegularDays = vac.regularDays;

    // Step 2: Record original distribution
    const db = new DbClient(tttConfig);
    try {
      const distBefore = await db.query(
        `SELECT year, days
         FROM ttt_vacation.vacation_days_distribution
         WHERE vacation = $1
         ORDER BY year`,
        [createdVacationId],
      );

      const step2Artifact = testInfo.outputPath("step2-distribution-before.json");
      await writeFile(step2Artifact, JSON.stringify({
        vacationId: createdVacationId,
        distributionRows: distBefore,
        rowCount: distBefore.length,
        totalDays: distBefore.reduce((s: number, r: Record<string, unknown>) => s + Number(r.days), 0),
        originalRegularDays,
      }, null, 2), "utf-8");
      await testInfo.attach("step2-distribution-before", { path: step2Artifact, contentType: "application/json" });

      expect(distBefore.length, "Cross-year vacation should have distribution entries").toBeGreaterThanOrEqual(1);

      const totalBefore = distBefore.reduce(
        (s: number, r: Record<string, unknown>) => s + Number(r.days), 0,
      );
      expect(totalBefore, "Distribution total should equal regularDays").toBe(originalRegularDays);

      // Step 3: Update vacation to shorten (end in December — single year)
      const updateResp = await request.put(`${vacUrl}/${createdVacationId}`, {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        data: data.buildUpdateBody(createdVacationId),
      });

      const updateBody = await updateResp.json();
      const step3Artifact = testInfo.outputPath("step3-update-shorten.json");
      await writeFile(step3Artifact, JSON.stringify(updateBody, null, 2), "utf-8");
      await testInfo.attach("step3-update-shorten", { path: step3Artifact, contentType: "application/json" });

      expect(updateResp.status(), "Update should return 200").toBe(200);
      const updatedVac = updateBody.vacation;
      expect(updatedVac).toBeTruthy();

      const shortenedRegularDays = updatedVac.regularDays;
      expect(
        shortenedRegularDays,
        "Shortened vacation should have fewer regular days",
      ).toBeLessThan(originalRegularDays);

      // Step 4: Check distribution AFTER update — should be recalculated
      const distAfter = await db.query(
        `SELECT year, days
         FROM ttt_vacation.vacation_days_distribution
         WHERE vacation = $1
         ORDER BY year`,
        [createdVacationId],
      );

      const totalAfter = distAfter.reduce(
        (s: number, r: Record<string, unknown>) => s + Number(r.days), 0,
      );

      const step4Artifact = testInfo.outputPath("step4-distribution-after.json");
      await writeFile(step4Artifact, JSON.stringify({
        vacationId: createdVacationId,
        distributionBefore: distBefore,
        distributionAfter: distAfter,
        totalBefore,
        totalAfter,
        regularDaysBefore: originalRegularDays,
        regularDaysAfter: shortenedRegularDays,
        redistributed: totalBefore !== totalAfter,
      }, null, 2), "utf-8");
      await testInfo.attach("step4-distribution-after", { path: step4Artifact, contentType: "application/json" });

      // Distribution total should now equal the new (shorter) regularDays
      expect(
        totalAfter,
        `After shortening, distribution total (${totalAfter}) should equal new regularDays (${shortenedRegularDays})`,
      ).toBe(shortenedRegularDays);

      // Distribution should have fewer total days than before
      expect(
        totalAfter,
        "Distribution total should decrease after shortening",
      ).toBeLessThan(totalBefore);

      // Step 5: Verify the shortened vacation dates in DB
      const vacRow = await db.queryOne(
        `SELECT start_date, end_date
         FROM ttt_vacation.vacation
         WHERE id = $1`,
        [createdVacationId],
      );

      const step5Artifact = testInfo.outputPath("step5-dates-after-update.json");
      await writeFile(step5Artifact, JSON.stringify({
        dbStartDate: vacRow.start_date,
        dbEndDate: vacRow.end_date,
        expectedEndDate: data.endDateShortened,
        nowSingleYear: String(vacRow.start_date).slice(0, 4) === String(vacRow.end_date).slice(0, 4),
      }, null, 2), "utf-8");
      await testInfo.attach("step5-dates-after-update", { path: step5Artifact, contentType: "application/json" });

      // After shortening, the vacation should be within a single year
      const afterStartYear = new Date(vacRow.start_date as string).getFullYear();
      const afterEndYear = new Date(vacRow.end_date as string).getFullYear();
      expect(
        afterStartYear,
        `After shortening, vacation should be within single calendar year (start: ${afterStartYear}, end: ${afterEndYear})`,
      ).toBe(afterEndYear);
    } finally {
      await db.close();
    }
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, {
        headers: authHeaders,
      });
    }
  }
});
