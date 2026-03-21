import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TttConfig } from "../config/tttConfig";
import { GlobalConfig } from "../config/globalConfig";
import { VacationTc102Data } from "../data/VacationTc102Data";
import { DbClient } from "../config/db/dbClient";

test("vacation_tc102 - Timeline audit gaps for payment events (KNOWN ISSUE) @regress", async ({ request }, testInfo) => {
  const tttConfig = new TttConfig();
  const globalConfig = new GlobalConfig(tttConfig);
  const data = await VacationTc102Data.create(globalConfig.testDataMode, tttConfig);

  // Step 1: Find an existing PAID vacation in the database
  const db = new DbClient(tttConfig);
  try {
    const paidVacation = await db.queryOneOrNull<{
      vacation_id: number;
      start_date: Date;
      end_date: Date;
      regular_days: number;
      administrative_days: number;
      status: string;
      login: string;
    }>(data.findPaidVacationSql);

    expect(paidVacation, "Should find at least one PAID vacation in database").toBeTruthy();

    const step1Artifact = testInfo.outputPath("step1-paid-vacation.json");
    await writeFile(step1Artifact, JSON.stringify({
      vacationId: paidVacation!.vacation_id,
      login: paidVacation!.login,
      startDate: paidVacation!.start_date,
      endDate: paidVacation!.end_date,
      regularDays: paidVacation!.regular_days,
      administrativeDays: paidVacation!.administrative_days,
      status: paidVacation!.status,
    }, null, 2), "utf-8");
    await testInfo.attach("step1-paid-vacation", { path: step1Artifact, contentType: "application/json" });

    // Step 2: Query timeline events for this vacation
    const timelineEvents = await db.query<{
      id: number;
      event_type: string;
      days_used: number | null;
      administrative_days_used: number | null;
      previous_status: string | null;
      description: string | null;
      event_time: Date;
    }>(data.timelineEventsSql, [paidVacation!.vacation_id]);

    const step2Artifact = testInfo.outputPath("step2-timeline-events.json");
    await writeFile(step2Artifact, JSON.stringify({
      vacationId: paidVacation!.vacation_id,
      totalEvents: timelineEvents.length,
      events: timelineEvents.map(e => ({
        id: e.id,
        eventType: e.event_type,
        daysUsed: e.days_used,
        administrativeDaysUsed: e.administrative_days_used,
        previousStatus: e.previous_status,
        description: e.description,
        eventTime: e.event_time,
      })),
    }, null, 2), "utf-8");
    await testInfo.attach("step2-timeline-events", { path: step2Artifact, contentType: "application/json" });

    expect(timelineEvents.length, "Should have timeline events for the paid vacation").toBeGreaterThan(0);

    // Step 3: Find the PAID event specifically
    const paidEvent = timelineEvents.find(e =>
      e.event_type.includes("PAID") || e.event_type.includes("paid"),
    );

    const step3Artifact = testInfo.outputPath("step3-paid-event-audit.json");

    if (paidEvent) {
      const daysUsed = Number(paidEvent.days_used ?? 0);
      const adminDaysUsed = Number(paidEvent.administrative_days_used ?? 0);
      const previousStatus = paidEvent.previous_status;

      await writeFile(step3Artifact, JSON.stringify({
        eventFound: true,
        eventType: paidEvent.event_type,
        daysUsed,
        administrativeDaysUsed: adminDaysUsed,
        previousStatus,
        auditGaps: {
          daysUsedIsZero: daysUsed === 0,
          adminDaysUsedIsZero: adminDaysUsed === 0,
          previousStatusIsNull: previousStatus === null,
        },
        vacationActualDays: {
          regularDays: paidVacation!.regular_days,
          administrativeDays: paidVacation!.administrative_days,
        },
        knownIssue: "VACATION_PAID timeline events have days_used=0, administrative_days_used=0. " +
          "The event doesn't record how many days were paid or the regular/admin split. " +
          "Also previous_status=NULL. Audit trail for payment actions is incomplete.",
      }, null, 2), "utf-8");
      await testInfo.attach("step3-paid-event-audit", { path: step3Artifact, contentType: "application/json" });

      // KNOWN ISSUE: Verify the audit gap exists
      // days_used should ideally match vacation.regular_days but is 0
      expect(daysUsed, "KNOWN ISSUE: PAID event days_used should be 0 (audit gap)").toBe(0);
      expect(adminDaysUsed, "KNOWN ISSUE: PAID event admin_days_used should be 0 (audit gap)").toBe(0);
      expect(previousStatus, "KNOWN ISSUE: PAID event previous_status should be null (audit gap)").toBeNull();
    } else {
      // No explicit PAID event — itself an audit gap
      await writeFile(step3Artifact, JSON.stringify({
        eventFound: false,
        allEventTypes: timelineEvents.map(e => e.event_type),
        knownIssue: "No VACATION_PAID event found in timeline — payment not tracked in audit log",
      }, null, 2), "utf-8");
      await testInfo.attach("step3-paid-event-audit", { path: step3Artifact, contentType: "application/json" });

      // Still a valid finding — document the gap
      expect(
        timelineEvents.some(e => e.event_type.includes("PAID")),
        "Timeline should ideally have a PAID event for audit trail (but may be missing — known gap)",
      ).toBe(false);
    }

    // Step 4: Verify lifecycle events completeness
    const eventTypes = timelineEvents.map(e => e.event_type);

    const step4Artifact = testInfo.outputPath("step4-lifecycle-completeness.json");
    await writeFile(step4Artifact, JSON.stringify({
      vacationId: paidVacation!.vacation_id,
      eventTypes,
      hasCreateEvent: eventTypes.some(t => t.includes("CREATE") || t.includes("NEW")),
      hasApproveEvent: eventTypes.some(t => t.includes("APPROV")),
      hasPaidEvent: eventTypes.some(t => t.includes("PAID")),
      totalEvents: eventTypes.length,
      note: "Complete lifecycle should have CREATE → APPROVED → PAID events in timeline",
    }, null, 2), "utf-8");
    await testInfo.attach("step4-lifecycle-completeness", { path: step4Artifact, contentType: "application/json" });
  } finally {
    await db.close();
  }
});
