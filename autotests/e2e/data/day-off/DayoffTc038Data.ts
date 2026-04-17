declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { createNewRequestForDate } from "./queries/dayoffQueries";

interface Tc038Args {
  employeeId: number;
  employeeLogin: string;
  managerId: number;
  officeId: number;
  officeName: string;
  calendarId: number;
  calDayId: number;
  requestId: number;
  originalDate: string;
  personalDate: string;
}

/**
 * TC-DO-038: Auto-deletion triggers vacation recalculation in AV=False office.
 *
 * Creates an APPROVED transfer request in an AV=False office, then deletes
 * the calendar day. The cascade should:
 * 1. Set the request to DELETED_FROM_CALENDAR
 * 2. Delete the ledger entry
 * 3. Recalculate vacation balance (BUG-DO-22: balance not updated after auto-deletion)
 *
 * Also verifies no incorrect Administrative leave conversion (BUG-DO-16).
 */
export class DayoffTc038Data {
  readonly employeeId: number;
  readonly employeeLogin: string;
  readonly managerId: number;
  readonly officeId: number;
  readonly officeName: string;
  readonly calendarId: number;
  readonly calDayId: number;
  readonly requestId: number;
  readonly originalDate: string;
  readonly personalDate: string;

  constructor(args: Tc038Args) {
    this.employeeId = args.employeeId;
    this.employeeLogin = args.employeeLogin;
    this.managerId = args.managerId;
    this.officeId = args.officeId;
    this.officeName = args.officeName;
    this.calendarId = args.calendarId;
    this.calDayId = args.calDayId;
    this.requestId = args.requestId;
    this.originalDate = args.originalDate;
    this.personalDate = args.personalDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc038Data> {
    const defaults: Tc038Args = {
      employeeId: 0,
      employeeLogin: process.env.DAYOFF_TC038_EMPLOYEE ?? "ogribanova",
      managerId: 0,
      officeId: 2,
      officeName: "Сатурн",
      calendarId: 0,
      calDayId: 0,
      requestId: 0,
      originalDate: "2026-05-01",
      personalDate: "2026-05-15",
    };
    if (mode === "static") return new DayoffTc038Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc038Args>("DayoffTc038Data");
      if (cached) return new DayoffTc038Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find an employee in an AV=False office with a free future holiday
      const emp = await db.queryOne<{
        empId: number; empLogin: string; mgrId: number;
        offId: number; offName: string;
        calId: number; calDayId: number;
        holDate: string;
      }>(
        `SELECT e.id AS "empId", e.login AS "empLogin", e.manager AS "mgrId",
                o.id AS "offId", o.name AS "offName",
                oc.calendar_id AS "calId", cd.id AS "calDayId",
                cd.calendar_date::text AS "holDate"
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.office o ON e.office_id = o.id
         JOIN ttt_calendar.office_calendar oc ON oc.office_id = o.id
         JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = oc.calendar_id
         WHERE e.enabled = true AND e.manager IS NOT NULL
           AND o.advance_vacation = false
           AND cd.duration = 0
           AND cd.calendar_date > CURRENT_DATE + INTERVAL '7 days'
           AND oc.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
           AND NOT EXISTS (
             SELECT 1 FROM ttt_calendar.office_calendar x
             WHERE x.office_id = oc.office_id AND x.since_year > oc.since_year
               AND x.since_year <= EXTRACT(YEAR FROM CURRENT_DATE))
           AND NOT EXISTS (
             SELECT 1 FROM ttt_vacation.employee_dayoff_request r
             WHERE r.employee = e.id AND r.original_date = cd.calendar_date
               AND r.status NOT IN ('DELETED','DELETED_FROM_CALENDAR','CANCELED'))
         ORDER BY cd.calendar_date
         LIMIT 1`,
      );

      // Create a NEW request and approve it via DB
      const created = await createNewRequestForDate(
        db, emp.empId, emp.mgrId, emp.holDate,
      );
      await db.query(
        `UPDATE ttt_vacation.employee_dayoff_request SET status = 'APPROVED' WHERE id = $1`,
        [created.requestId],
      );

      const args: Tc038Args = {
        employeeId: emp.empId,
        employeeLogin: emp.empLogin,
        managerId: emp.mgrId,
        officeId: emp.offId,
        officeName: emp.offName,
        calendarId: emp.calId,
        calDayId: emp.calDayId,
        requestId: created.requestId,
        originalDate: emp.holDate,
        personalDate: created.personalDate ?? emp.holDate,
      };
      saveToDisk("DayoffTc038Data", args);
      return new DayoffTc038Data(args);
    } finally {
      await db.close();
    }
  }
}
