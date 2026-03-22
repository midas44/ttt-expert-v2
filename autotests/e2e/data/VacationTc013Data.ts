declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * TC-VAC-013: Create vacation starting today.
 * Boundary test — verifies today's date is accepted (past dates are rejected).
 * Uses nearest weekday if today is a weekend.
 */
export class VacationTc013Data {
  readonly username: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;
  readonly expectedStatus = "New";
  readonly notificationText =
    "A new vacation request has been created";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc013Data> {
    if (mode === "static") return new VacationTc013Data();

    const targetDate = VacationTc013Data.nearestWeekday(new Date());
    const targetIso = VacationTc013Data.toIso(targetDate);
    const formatted = VacationTc013Data.toDdMmYyyy(targetDate);

    const db = new DbClient(tttConfig);
    try {
      // Find employee with days and no conflict on target date
      const row = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE e.enabled = true
           AND e.manager IS NOT NULL
           AND ev.available_vacation_days >= 1
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND NOT EXISTS (
             SELECT 1 FROM ttt_vacation.vacation v
             WHERE v.employee = e.id
               AND v.start_date <= $1::date
               AND v.end_date >= $1::date
           )
         ORDER BY random()
         LIMIT 1`,
        [targetIso],
      );
      return new VacationTc013Data(row.login, formatted, formatted);
    } finally {
      await db.close();
    }
  }

  private static nearestWeekday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 0) d.setDate(d.getDate() + 1);
    else if (day === 6) d.setDate(d.getDate() + 2);
    return d;
  }

  private static toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private static toDdMmYyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  constructor(
    username = process.env.VACATION_TC013_USERNAME ?? "amelnikova",
    startDate = process.env.VACATION_TC013_START_DATE ?? "23.03.2026",
    endDate = process.env.VACATION_TC013_END_DATE ?? "23.03.2026",
  ) {
    this.username = username;
    this.startDate = startDate;
    this.endDate = endDate;
    this.periodPattern = this.buildPeriodPattern();
  }

  private buildPeriodPattern(): RegExp {
    const start = this.parseDate(this.startDate);
    const end = this.parseDate(this.endDate);
    const sDay = start.getUTCDate();
    const sMonth = start.getUTCMonth();
    const sYear = start.getUTCFullYear();
    const eDay = end.getUTCDate();
    const eMonth = end.getUTCMonth();
    const eYear = end.getUTCFullYear();
    const sDD = String(sDay).padStart(2, "0");
    const sMM = String(sMonth + 1).padStart(2, "0");
    const eDD = String(eDay).padStart(2, "0");
    const eMM = String(eMonth + 1).padStart(2, "0");

    const alternatives = [
      `0?${sDay}\\s*[–\\-]\\s*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}\\w*\\s+${eYear}`,
      `${sDD}\\.${sMM}\\.${sYear}.*${eDD}\\.${eMM}\\.${eYear}`,
      `${MONTH_NAMES[sMonth]}\\s+${sDay}.*${MONTH_NAMES[eMonth]}\\s+${eDay}`,
      `0?${sDay}\\s+${MONTH_ABBREVS[sMonth]}.*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}`,
      // Single day display
      `0?${sDay}\\s+${MONTH_ABBREVS[sMonth]}\\w*\\s+${sYear}`,
    ];
    return new RegExp(alternatives.join("|"));
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
