declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

interface Tc046Args {
  username: string;
  startIso: string;
  endIso: string;
  startInput: string;
  endInput: string;
  holidayDateIso: string;
  expectedWorkingDays: number;
}

/**
 * TC-VAC-046: Holiday impact on working days count.
 * Finds an employee whose office has a public holiday on a future weekday,
 * then builds a Mon-Fri range around it. The "Number of days" in the creation
 * dialog should show (5 - holidays_in_range) instead of 5.
 *
 * Schema join path:
 *   ttt_vacation.employee.office_id → ttt_calendar.office_calendar.office_id
 *   → ttt_calendar.office_calendar.calendar_id → ttt_calendar.calendar.id
 *   → ttt_calendar.calendar_days.calendar_id
 * Column: calendar_days.calendar_date (not event_date), calendar_days.duration (0=holiday)
 */
export class VacationTc046Data {
  readonly username: string;
  readonly startIso: string;
  readonly endIso: string;
  readonly startInput: string;
  readonly endInput: string;
  readonly holidayDateIso: string;
  readonly expectedWorkingDays: number;

  constructor(args: Tc046Args) {
    this.username = args.username;
    this.startIso = args.startIso;
    this.endIso = args.endIso;
    this.startInput = args.startInput;
    this.endInput = args.endInput;
    this.holidayDateIso = args.holidayDateIso;
    this.expectedWorkingDays = args.expectedWorkingDays;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc046Data> {
    if (mode === "static") {
      return new VacationTc046Data({
        username: "pvaynmaster",
        startIso: "2026-06-08",
        endIso: "2026-06-12",
        startInput: "08.06.2026",
        endInput: "12.06.2026",
        holidayDateIso: "2026-06-12",
        expectedWorkingDays: 4,
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc046Args>("VacationTc046Data");
      if (cached) return new VacationTc046Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find future weekday holidays via office_calendar → calendar → calendar_days
      const holidays = await db.query<{
        holiday: string;
        office_id: string;
      }>(
        `SELECT cd.calendar_date::text AS holiday,
                oc.office_id::text AS office_id
         FROM ttt_calendar.calendar_days cd
         JOIN ttt_calendar.calendar c ON cd.calendar_id = c.id
         JOIN ttt_calendar.office_calendar oc ON oc.calendar_id = c.id
         WHERE cd.calendar_date > CURRENT_DATE + 14
           AND cd.duration = 0
           AND EXTRACT(DOW FROM cd.calendar_date) BETWEEN 1 AND 5
         ORDER BY cd.calendar_date
         LIMIT 50`,
      );

      for (const h of holidays) {
        const holidayDate = new Date(h.holiday + "T12:00:00Z");
        const dow = holidayDate.getUTCDay(); // 1=Mon..5=Fri
        if (dow < 1 || dow > 5) continue;

        // Build the Mon-Fri week containing this holiday
        const monday = new Date(holidayDate);
        monday.setUTCDate(holidayDate.getUTCDate() - (dow - 1));
        const friday = new Date(monday);
        friday.setUTCDate(monday.getUTCDate() + 4);

        const monIso = toIso(monday);
        const friIso = toIso(friday);

        // Count holidays in this Mon-Fri range for this office's calendar
        const countRow = await db.queryOne<{ cnt: string }>(
          `SELECT COUNT(*)::text AS cnt
           FROM ttt_calendar.calendar_days cd
           JOIN ttt_calendar.calendar c ON cd.calendar_id = c.id
           JOIN ttt_calendar.office_calendar oc ON oc.calendar_id = c.id
           WHERE oc.office_id = $1::bigint
             AND cd.calendar_date BETWEEN $2::date AND $3::date
             AND cd.duration = 0`,
          [h.office_id, monIso, friIso],
        );

        const holidayCount = Number(countRow.cnt);
        if (holidayCount < 1 || holidayCount > 3) continue;

        // Find employee in this office with sufficient days and manager
        const emp = await db.queryOneOrNull<{ login: string }>(
          `SELECT e.login
           FROM ttt_vacation.employee e
           JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
           WHERE e.office_id = $1::bigint
             AND e.enabled = true
             AND e.manager IS NOT NULL
             AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
             AND ev.available_vacation_days >= 10
           ORDER BY random()
           LIMIT 1`,
          [h.office_id],
        );

        if (!emp) continue;

        // Check for existing vacation conflicts
        if (await hasVacationConflict(db, emp.login, monIso, friIso)) continue;

        const expectedDays = 5 - holidayCount;

        const args: Tc046Args = {
          username: emp.login,
          startIso: monIso,
          endIso: friIso,
          startInput: toCalendarFormat(monIso),
          endInput: toCalendarFormat(friIso),
          holidayDateIso: h.holiday,
          expectedWorkingDays: expectedDays,
        };
        if (mode === "saved") saveToDisk("VacationTc046Data", args);
        return new VacationTc046Data(args);
      }

      throw new Error(
        "No suitable office holiday + employee combination found for TC-VAC-046",
      );
    } finally {
      await db.close();
    }
  }
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toCalendarFormat(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
