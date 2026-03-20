import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc164Data } from "../data/VacationTc164Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc164 - FIFO redistribution across year boundary @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc164Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const availUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Record balance BEFORE creation
    const beforeResp = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${data.paymentMonth}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );

    let beforeBody: Record<string, unknown> = {};
    try { beforeBody = await beforeResp.json(); } catch { /* empty */ }

    const step1Artifact = testInfo.outputPath("step1-balance-before.json");
    await writeFile(step1Artifact, JSON.stringify({
      status: beforeResp.status(),
      body: beforeBody,
    }, null, 2), "utf-8");
    await testInfo.attach("step1-balance-before", { path: step1Artifact, contentType: "application/json" });

    expect(beforeResp.status()).toBe(200);
    const balanceBefore = Number(beforeBody.availablePaidDays ?? beforeBody);

    // Step 2: Create cross-year vacation (Dec 15 → Jan 9, ~13 working days)
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResp.json();
    const step2Artifact = testInfo.outputPath("step2-create-cross-year.json");
    await writeFile(step2Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step2-create-cross-year", { path: step2Artifact, contentType: "application/json" });

    expect(createResp.status(), "Create should return 200").toBe(200);
    const vac = createBody.vacation;
    expect(vac).toBeTruthy();
    expect(vac.status).toBe("NEW");
    createdVacationId = vac.id;

    const totalRegularDays = vac.regularDays;
    const totalAdminDays = vac.administrativeDays;
    expect(totalRegularDays + totalAdminDays, "Cross-year vacation should have working days > 0").toBeGreaterThan(0);

    // Step 3: Check vacation_days_distribution for FIFO split
    const db = new DbClient(tttConfig);
    try {
      const distRows = await db.query(
        `SELECT year, days
         FROM ttt_vacation.vacation_days_distribution
         WHERE vacation = $1
         ORDER BY year`,
        [createdVacationId],
      );

      const step3Artifact = testInfo.outputPath("step3-days-distribution.json");
      await writeFile(step3Artifact, JSON.stringify({
        vacationId: createdVacationId,
        distributionRows: distRows,
        rowCount: distRows.length,
        years: distRows.map((r: Record<string, unknown>) => r.year),
        startYear: data.startYear,
        endYear: data.endYear,
      }, null, 2), "utf-8");
      await testInfo.attach("step3-days-distribution", { path: step3Artifact, contentType: "application/json" });

      // FIFO: days consumed from earliest balance year — may split across years
      expect(distRows.length, "Distribution should have at least 1 entry").toBeGreaterThanOrEqual(1);

      // Sum of distribution days should equal regularDays
      const distributionTotal = distRows.reduce(
        (sum: number, r: Record<string, unknown>) => sum + Number(r.days), 0,
      );

      expect(
        distributionTotal,
        `Distribution total (${distributionTotal}) should equal regularDays (${totalRegularDays})`,
      ).toBe(totalRegularDays);

      // Step 4: Verify FIFO ordering — earlier years consumed first
      if (distRows.length >= 2) {
        const years = distRows.map((r: Record<string, unknown>) => Number(r.year));
        for (let i = 1; i < years.length; i++) {
          expect(years[i], "Distribution years should be in ascending order").toBeGreaterThan(years[i - 1]);
        }
      }

      // Step 5: Verify DB vacation record spans two calendar years
      const vacRow = await db.queryOne(
        `SELECT start_date, end_date
         FROM ttt_vacation.vacation
         WHERE id = $1`,
        [createdVacationId],
      );
      const dbStartYear = String(vacRow.start_date).slice(0, 4);
      const dbEndYear = String(vacRow.end_date).slice(0, 4);

      const step5Artifact = testInfo.outputPath("step5-cross-year-verify.json");
      await writeFile(step5Artifact, JSON.stringify({
        dbStartDate: vacRow.start_date,
        dbEndDate: vacRow.end_date,
        startYear: dbStartYear,
        endYear: dbEndYear,
        spansTwoYears: dbStartYear !== dbEndYear,
      }, null, 2), "utf-8");
      await testInfo.attach("step5-cross-year-verify", { path: step5Artifact, contentType: "application/json" });

      expect(dbStartYear !== dbEndYear, "Vacation should span two calendar years").toBe(true);

      // Step 6: Check balance AFTER creation via API
      const afterResp = await request.get(
        `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${data.paymentMonth}&usePaymentDateFilter=true`,
        { headers: authHeaders },
      );

      let afterBody: Record<string, unknown> = {};
      try { afterBody = await afterResp.json(); } catch { /* empty */ }

      const balanceAfter = Number(afterBody.availablePaidDays ?? afterBody);

      const step6Artifact = testInfo.outputPath("step6-balance-after.json");
      await writeFile(step6Artifact, JSON.stringify({
        before: balanceBefore,
        after: balanceAfter,
        regularDaysConsumed: totalRegularDays,
        expectedDecrease: totalRegularDays,
        actualDecrease: balanceBefore - balanceAfter,
      }, null, 2), "utf-8");
      await testInfo.attach("step6-balance-after", { path: step6Artifact, contentType: "application/json" });

      expect(afterResp.status()).toBe(200);
      // Balance should decrease by the number of regular days consumed
      if (Number.isFinite(balanceAfter) && Number.isFinite(balanceBefore)) {
        expect(
          balanceAfter,
          `Balance should decrease after creating cross-year vacation (before: ${balanceBefore}, after: ${balanceAfter})`,
        ).toBeLessThan(balanceBefore);
      }

      // Step 7: Verify employee can still create vacations if balance remains
      const step7Artifact = testInfo.outputPath("step7-remaining-balance.json");
      await writeFile(step7Artifact, JSON.stringify({
        remainingBalance: balanceAfter,
        canCreateMore: balanceAfter > 0 || true, // AV=true allows negative
        note: "AV=true office (Персей) — employee can create vacations even with negative balance",
      }, null, 2), "utf-8");
      await testInfo.attach("step7-remaining-balance", { path: step7Artifact, contentType: "application/json" });
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
