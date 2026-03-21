import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc153Data } from "../data/VacationTc153Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc153 - first vacation 3-month hardcoded restriction mechanism @regress", async ({ request }, testInfo) => {
  // 1. Configs and data
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc153Data.create(globalConfig.testDataMode, tttConfig);

  const apiToken = tttConfig.apiToken;
  expect(apiToken, "apiToken must be configured").toBeTruthy();

  const vacUrl = tttConfig.buildUrl(data.vacationEndpoint);
  const availUrl = tttConfig.buildUrl(data.availableDaysEndpoint);
  const authHeaders = { [data.authHeaderName]: apiToken };
  let createdVacationId: number | null = null;

  try {
    // Step 1: Get employee's firstDay from DB to verify employment duration
    const db = new DbClient(tttConfig);
    let firstDay: string;
    let monthsSinceHire: number;
    try {
      const empRow = await db.query(
        `SELECT e.login, e.first_day, e.office_id, o.name as office_name,
                o.advance_vacation as av_enabled
         FROM ttt_vacation.employee e
         LEFT JOIN ttt_vacation.office o ON e.office_id = o.id
         WHERE e.login = $1`,
        [data.login],
      );
      expect(empRow.length, "Employee should exist").toBe(1);

      firstDay = String(empRow[0].first_day);
      const firstDayDate = new Date(firstDay);
      const now = new Date();
      monthsSinceHire = (now.getFullYear() - firstDayDate.getFullYear()) * 12
        + (now.getMonth() - firstDayDate.getMonth());

      const step1Artifact = testInfo.outputPath("step1-employee-firstday.json");
      await writeFile(step1Artifact, JSON.stringify({
        login: data.login,
        firstDay,
        monthsSinceHire,
        officeId: empRow[0].office_id,
        officeName: empRow[0].office_name,
        advanceVacation: empRow[0].av_enabled,
        threeMonthRestriction: monthsSinceHire < 3
          ? "ACTIVE — employee within 3-month window, REGULAR vacation limit = 0"
          : "INACTIVE — employee past 3-month window, no restriction applies",
        mechanism: "DaysLimitationService: Limit(3, BigDecimal.valueOf(0)) — hardcoded, not configurable per office",
      }, null, 2), "utf-8");
      await testInfo.attach("step1-employee-firstday", { path: step1Artifact, contentType: "application/json" });
    } finally {
      await db.close();
    }

    // Step 2: Verify employee is past the 3-month restriction
    expect(
      monthsSinceHire,
      `Employee ${data.login} should be employed > 3 months (got ${monthsSinceHire})`,
    ).toBeGreaterThan(3);

    const step2Artifact = testInfo.outputPath("step2-restriction-check.json");
    await writeFile(step2Artifact, JSON.stringify({
      monthsSinceHire,
      restrictionThreshold: 3,
      restrictionActive: false,
      note: "Established employee — 3-month DaysLimitationService.Limit(3, 0) does not apply",
    }, null, 2), "utf-8");
    await testInfo.attach("step2-restriction-check", { path: step2Artifact, contentType: "application/json" });

    // Step 3: Get available REGULAR vacation days — should be > 0
    const availResp = await request.get(
      `${availUrl}?employeeLogin=${data.login}&newDays=0&paymentDate=${data.paymentMonth}&usePaymentDateFilter=true`,
      { headers: authHeaders },
    );

    let availBody: Record<string, unknown> = {};
    try { availBody = await availResp.json(); } catch { /* empty */ }

    const step3Artifact = testInfo.outputPath("step3-available-days.json");
    await writeFile(step3Artifact, JSON.stringify({
      status: availResp.status(),
      body: availBody,
      availablePaidDays: availBody.availablePaidDays,
      note: "For established employee, availablePaidDays should be > 0 (no 3-month restriction)",
    }, null, 2), "utf-8");
    await testInfo.attach("step3-available-days", { path: step3Artifact, contentType: "application/json" });

    expect(availResp.status()).toBe(200);
    const availableDays = Number(availBody.availablePaidDays ?? 0);
    expect(availableDays, "Available REGULAR days should be > 0 for established employee").toBeGreaterThan(0);

    // Step 4: Create a REGULAR vacation — should succeed (no 3-month restriction)
    const createResp = await request.post(vacUrl, {
      headers: { ...authHeaders, "Content-Type": "application/json" },
      data: data.buildCreateBody(),
    });

    const createBody = await createResp.json();
    const step4Artifact = testInfo.outputPath("step4-create-regular-vacation.json");
    await writeFile(step4Artifact, JSON.stringify(createBody, null, 2), "utf-8");
    await testInfo.attach("step4-create-regular-vacation", { path: step4Artifact, contentType: "application/json" });

    expect(createResp.status(), "REGULAR vacation creation should succeed for established employee").toBe(200);
    createdVacationId = createBody.vacation?.id;
    expect(createBody.vacation?.paymentType, "Payment type should be REGULAR").toBe("REGULAR");

    // Step 5: Verify CS setting firstVacation is NOT in DB (unimplemented)
    const db2 = new DbClient(tttConfig);
    try {
      const columns = await db2.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'ttt_vacation' AND table_name = 'office'
         AND column_name LIKE '%first_vacation%'`,
        [],
      );

      const step5Artifact = testInfo.outputPath("step5-no-firstVacation-column.json");
      await writeFile(step5Artifact, JSON.stringify({
        firstVacationColumnsFound: columns.length,
        columns,
        conclusion: columns.length === 0
          ? "Confirmed: CSSalaryOfficeVacationData.firstVacation is NOT synced to DB — hardcoded 3-month limit only"
          : "Unexpected: first_vacation column found — investigate",
        mechanism: "DaysLimitationService uses hardcoded List.of(new Limit(3, BigDecimal.valueOf(0))) for ALL offices",
      }, null, 2), "utf-8");
      await testInfo.attach("step5-no-firstVacation-column", { path: step5Artifact, contentType: "application/json" });

      expect(columns.length, "No first_vacation column should exist in office table").toBe(0);
    } finally {
      await db2.close();
    }
  } finally {
    if (createdVacationId) {
      await request.delete(`${vacUrl}/${createdVacationId}`, { headers: authHeaders });
    }
  }
});
