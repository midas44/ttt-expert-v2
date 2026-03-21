import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { VacationTc157Data } from "../data/VacationTc157Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc157 - office calendar migration Russia to Cyprus verification @regress", async ({}, testInfo) => {
  const tttConfig = new TttConfig();
  const data = new VacationTc157Data();

  // Step 1: Query office_calendar mappings for reference office
  const db = new DbClient(tttConfig);
  try {
    const mappings = await db.query(
      `SELECT oc.id, oc.office_id, oc.calendar_id, oc.since_year,
              c.name as calendar_name
       FROM ttt_calendar.office_calendar oc
       JOIN ttt_calendar.calendar c ON oc.calendar_id = c.id
       WHERE oc.office_id = $1
       ORDER BY oc.since_year`,
      [data.referenceOfficeId],
    );

    const step1Artifact = testInfo.outputPath("step1-office-calendar-mappings.json");
    await writeFile(step1Artifact, JSON.stringify({
      officeId: data.referenceOfficeId,
      officeName: data.referenceOfficeName,
      mappings,
      mappingCount: mappings.length,
    }, null, 2), "utf-8");
    await testInfo.attach("step1-office-calendar-mappings", { path: step1Artifact, contentType: "application/json" });

    // Should have at least 2 mappings (old + new calendar)
    expect(mappings.length, "Should have multiple calendar mappings (pre and post migration)").toBeGreaterThanOrEqual(2);

    // Step 2: Verify pre-migration calendar (<=2023 should be Russia)
    const preMigration = mappings.filter(
      (m: Record<string, unknown>) => Number(m.since_year) <= data.preYearBefore,
    );
    const postMigration = mappings.filter(
      (m: Record<string, unknown>) => Number(m.since_year) >= data.migrYearAfter,
    );

    const step2Artifact = testInfo.outputPath("step2-migration-split.json");
    await writeFile(step2Artifact, JSON.stringify({
      preYearBefore: data.preYearBefore,
      migrYearAfter: data.migrYearAfter,
      preMigration,
      postMigration,
    }, null, 2), "utf-8");
    await testInfo.attach("step2-migration-split", { path: step2Artifact, contentType: "application/json" });

    expect(preMigration.length, "Should have pre-migration calendar mapping").toBeGreaterThanOrEqual(1);
    expect(postMigration.length, "Should have post-migration calendar mapping").toBeGreaterThanOrEqual(1);

    // Verify calendar names
    const oldCalName = String(preMigration[preMigration.length - 1].calendar_name);
    const newCalName = String(postMigration[0].calendar_name);

    expect(
      oldCalName.toLowerCase().includes(data.expectedOldCalendarName.toLowerCase()),
      `Pre-migration calendar should be ${data.expectedOldCalendarName}, got: ${oldCalName}`,
    ).toBe(true);
    expect(
      newCalName.toLowerCase().includes(data.expectedNewCalendarName.toLowerCase()),
      `Post-migration calendar should be ${data.expectedNewCalendarName}, got: ${newCalName}`,
    ).toBe(true);

    // Step 3: Compare holiday counts between old and new calendars for January
    // calendar_days stores only exceptions (holidays/shortened days) with duration=0
    // Russia has Jan 1-8 New Year break (6 entries), Cyprus has only Jan 1 (1 entry)
    const oldCalId = preMigration[preMigration.length - 1].calendar_id;
    const newCalId = postMigration[0].calendar_id;

    const januaryComparison = await db.query(
      `SELECT c.name as calendar_name, c.id as calendar_id,
              COUNT(*) as holiday_count,
              string_agg(cd.reason, ', ' ORDER BY cd.calendar_date) as holidays
       FROM ttt_calendar.calendar_days cd
       JOIN ttt_calendar.calendar c ON cd.calendar_id = c.id
       WHERE cd.calendar_id IN ($1, $2)
       AND EXTRACT(MONTH FROM cd.calendar_date) = 1
       AND EXTRACT(YEAR FROM cd.calendar_date) = 2024
       AND cd.duration = 0
       GROUP BY c.id, c.name`,
      [oldCalId, newCalId],
    );

    const step3Artifact = testInfo.outputPath("step3-january-holidays.json");
    await writeFile(step3Artifact, JSON.stringify({
      month: "January 2024",
      comparison: januaryComparison,
      note: "calendar_days stores holiday exceptions only. Russia has extended New Year break (6 days), Cyprus has 1 day.",
    }, null, 2), "utf-8");
    await testInfo.attach("step3-january-holidays", { path: step3Artifact, contentType: "application/json" });

    // Russia should have more January holidays than Cyprus
    if (januaryComparison.length === 2) {
      const russiaJan = januaryComparison.find(
        (r: Record<string, unknown>) => String(r.calendar_name).toLowerCase().includes("russia"),
      );
      const cyprusJan = januaryComparison.find(
        (r: Record<string, unknown>) => String(r.calendar_name).toLowerCase().includes("cyprus"),
      );

      if (russiaJan && cyprusJan) {
        expect(
          Number(russiaJan.holiday_count),
          "Russia should have more January holidays than Cyprus (New Year break)",
        ).toBeGreaterThan(Number(cyprusJan.holiday_count));
      }
    }

    // Step 4: Query all migrated offices to verify scope
    const allMigrations = await db.query(
      `SELECT oc.office_id, o.name as office_name, c.name as calendar_name, oc.since_year
       FROM ttt_calendar.office_calendar oc
       JOIN ttt_calendar.calendar c ON oc.calendar_id = c.id
       LEFT JOIN ttt_vacation.office o ON oc.office_id = o.id
       WHERE oc.since_year = $1
       AND c.name != 'Russia'
       ORDER BY oc.office_id`,
      [data.migrYearAfter],
    );

    const step4Artifact = testInfo.outputPath("step4-all-migrated-offices.json");
    await writeFile(step4Artifact, JSON.stringify({
      migrationYear: data.migrYearAfter,
      migratedOffices: allMigrations,
      totalMigrated: allMigrations.length,
      note: "12 offices switched from Russia to local calendars in 2024",
    }, null, 2), "utf-8");
    await testInfo.attach("step4-all-migrated-offices", { path: step4Artifact, contentType: "application/json" });

    expect(allMigrations.length, "Multiple offices should have migrated in 2024").toBeGreaterThanOrEqual(5);

    // Step 5: Verify since_year resolution logic — for year 2023, office 10 uses Russia; for 2025, uses Cyprus
    // The query `findYearLessOrEqual(officeId, year)` returns the most recent mapping <= year
    const resolveOld = await db.query(
      `SELECT oc.since_year, c.name as calendar_name
       FROM ttt_calendar.office_calendar oc
       JOIN ttt_calendar.calendar c ON oc.calendar_id = c.id
       WHERE oc.office_id = $1 AND oc.since_year <= $2
       ORDER BY oc.since_year DESC
       LIMIT 1`,
      [data.referenceOfficeId, data.preYearBefore],
    );

    const resolveNew = await db.query(
      `SELECT oc.since_year, c.name as calendar_name
       FROM ttt_calendar.office_calendar oc
       JOIN ttt_calendar.calendar c ON oc.calendar_id = c.id
       WHERE oc.office_id = $1 AND oc.since_year <= $2
       ORDER BY oc.since_year DESC
       LIMIT 1`,
      [data.referenceOfficeId, 2025],
    );

    const step5Artifact = testInfo.outputPath("step5-year-resolution.json");
    await writeFile(step5Artifact, JSON.stringify({
      officeId: data.referenceOfficeId,
      queryYear2023: { year: 2023, resolved: resolveOld[0] },
      queryYear2025: { year: 2025, resolved: resolveNew[0] },
      note: "findYearLessOrEqual(officeId, year) returns most recent mapping <= year",
    }, null, 2), "utf-8");
    await testInfo.attach("step5-year-resolution", { path: step5Artifact, contentType: "application/json" });

    // For 2023: should resolve to Russia
    expect(
      String(resolveOld[0]?.calendar_name ?? "").toLowerCase(),
      "2023 should resolve to Russia calendar",
    ).toContain("russia");

    // For 2025: should resolve to Cyprus
    expect(
      String(resolveNew[0]?.calendar_name ?? "").toLowerCase(),
      "2025 should resolve to Cyprus calendar",
    ).toContain("cyprus");
  } finally {
    await db.close();
  }
});
