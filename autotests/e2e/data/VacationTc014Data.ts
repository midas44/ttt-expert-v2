declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * TC-VAC-014: Create cross-year vacation (December to January).
 *
 * Finds an employee with sufficient days and a manager,
 * computes Dec→Jan dates spanning the year boundary.
 * If real month is Jan-Oct, the test must set the server clock
 * to late November so the Dec dates are "soon" enough for the UI.
 */
export class VacationTc014Data {
  readonly username: string;
  readonly startDate: string; // dd.mm.yyyy — a weekday in late December
  readonly endDate: string; // dd.mm.yyyy — a weekday in early January (next year)
  readonly startIso: string; // yyyy-mm-dd — for API/DB
  readonly endIso: string; // yyyy-mm-dd — for API/DB
  /** Multi-format period pattern matching table row text. */
  readonly periodPattern: RegExp;
  /** ISO datetime string for setting the server clock (Nov 15 of the vacation year). */
  readonly clockTime: string;
  /** Whether the clock needs to be set (true if real month is Jan-Oct). */
  readonly needsClockChange: boolean;
  /** The year of the start date (December). */
  readonly startYear: number;
  /** The year of the end date (January). */
  readonly endYear: number;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc014Data> {
    if (mode === "static") return new VacationTc014Data();

    const db = new DbClient(tttConfig);
    try {
      const startYear = VacationTc014Data.computeStartYear();
      const endYear = startYear + 1;
      const decStart = `${startYear}-12-28`;
      const janEnd = `${endYear}-01-08`;

      const row = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE e.enabled = true
           AND e.manager IS NOT NULL
           AND ev.year = $1
           AND ev.available_vacation_days >= 5
           AND NOT EXISTS (
             SELECT 1 FROM ttt_vacation.vacation v
             WHERE v.employee = e.id
               AND v.status NOT IN ('CANCELED', 'DELETED')
               AND v.start_date <= $3::date
               AND v.end_date >= $2::date
           )
         ORDER BY random()
         LIMIT 1`,
        [startYear, decStart, janEnd],
      );

      return new VacationTc014Data(row.login, startYear);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC014_USERNAME ?? "pvaynmaster",
    startYear = VacationTc014Data.computeStartYear(),
  ) {
    this.username = username;
    this.startYear = startYear;
    this.endYear = startYear + 1;

    // Use Dec 28 (Monday in 2026) → Jan 8 (Friday in 2027)
    // This avoids Christmas week complications
    const decDate = VacationTc014Data.nextWeekday(
      new Date(startYear, 11, 28),
      1,
    ); // Monday
    const janDate = VacationTc014Data.nextWeekday(
      new Date(this.endYear, 0, 5),
      5,
    ); // Friday

    this.startDate = VacationTc014Data.toDdMmYyyy(decDate);
    this.endDate = VacationTc014Data.toDdMmYyyy(janDate);
    this.startIso = VacationTc014Data.toIso(decDate);
    this.endIso = VacationTc014Data.toIso(janDate);

    // Build multi-format period pattern (same approach as verified tests)
    this.periodPattern = this.buildPeriodPattern(decDate, janDate);

    // Clock: set to Nov 15 of startYear at 12:00
    this.clockTime = `${startYear}-11-15T12:00:00`;

    // Need clock change if real month is Jan-Oct
    const realMonth = new Date().getMonth(); // 0-indexed
    this.needsClockChange = realMonth <= 9; // Jan(0) through Oct(9)
  }

  private buildPeriodPattern(start: Date, end: Date): RegExp {
    const sDay = start.getDate();
    const sMonth = start.getMonth();
    const sYear = start.getFullYear();
    const eDay = end.getDate();
    const eMonth = end.getMonth();
    const eYear = end.getFullYear();
    const sDD = String(sDay).padStart(2, "0");
    const sMM = String(sMonth + 1).padStart(2, "0");
    const eDD = String(eDay).padStart(2, "0");
    const eMM = String(eMonth + 1).padStart(2, "0");

    // Table can show "28 Dec 2026 - 08 Jan 2027" or "28.12.2026 - 08.01.2027"
    // Cross-year: months differ, so use cross-month patterns
    const alternatives = [
      // "28 Dec 2026 - 08 Jan 2027" (English format with month names)
      `0?${sDay}\\s+${MONTH_ABBREVS[sMonth]}\\w*\\s+${sYear}\\s*[–\\-]\\s*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}\\w*\\s+${eYear}`,
      // "28.12.2026 - 08.01.2027" (dot format)
      `${sDD}\\.${sMM}\\.${sYear}\\s*[–\\-]\\s*${eDD}\\.${eMM}\\.${eYear}`,
      // Loose: Dec + year ... Jan + year
      `${MONTH_ABBREVS[sMonth]}\\w*.*${sYear}.*${MONTH_ABBREVS[eMonth]}\\w*.*${eYear}`,
    ];
    return new RegExp(alternatives.join("|"));
  }

  private static computeStartYear(): number {
    return new Date().getFullYear();
  }

  /** Returns the next occurrence of the given weekday (1=Mon, 5=Fri) on or after date. */
  private static nextWeekday(date: Date, targetDay: number): Date {
    const d = new Date(date);
    while (d.getDay() !== targetDay) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  private static toDdMmYyyy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }

  private static toIso(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}
