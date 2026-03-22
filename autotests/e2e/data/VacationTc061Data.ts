declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * TC-VAC-061: Verify day recalculation after cancel.
 * Create 5-day vacation, cancel it, verify days returned.
 */
export class VacationTc061Data {
  readonly employeeLogin: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc061Data> {
    if (mode === "static") return new VacationTc061Data();

    const db = new DbClient(tttConfig);
    try {
      // Find employee in AV=true office with sufficient days
      const emp = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         JOIN ttt_backend.employee be ON be.login = e.login
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         JOIN ttt_vacation.office o ON e.office_id = o.id
         WHERE e.enabled = true
           AND (be.is_contractor IS NULL OR be.is_contractor = false)
           AND r.role_name = 'ROLE_EMPLOYEE'
           AND o.advance_vacation = true
           AND e.manager IS NOT NULL
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND (ev.available_vacation_days - COALESCE(
             (SELECT SUM(v.regular_days)
              FROM ttt_vacation.vacation v
              WHERE v.employee = e.id
                AND v.status IN ('NEW', 'APPROVED')),
             0)) >= 5
         ORDER BY random()
         LIMIT 1`,
      );

      const range = await VacationTc061Data.findAvailableRange(
        db,
        emp.login,
      );
      return new VacationTc061Data(emp.login, range.start, range.end);
    } finally {
      await db.close();
    }
  }

  private static async findAvailableRange(
    db: DbClient,
    login: string,
  ): Promise<{ start: string; end: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + 14);

    for (let attempt = 0; attempt < 16; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

      const startIso = VacationTc061Data.toIso(start);
      const endIso = VacationTc061Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return {
          start: VacationTc061Data.toDdMmYyyy(start),
          end: VacationTc061Data.toDdMmYyyy(end),
        };
      }
    }
    throw new Error(
      `No conflict-free Mon-Fri window for "${login}" within 16 weeks`,
    );
  }

  private static toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private static toDdMmYyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  constructor(
    employeeLogin = process.env.VACATION_TC061_EMPLOYEE ?? "amelnikova",
    startDate = process.env.VACATION_TC061_START ?? "13.04.2026",
    endDate = process.env.VACATION_TC061_END ?? "17.04.2026",
  ) {
    this.employeeLogin = employeeLogin;
    this.startDate = startDate;
    this.endDate = endDate;
    this.periodPattern = this.buildPattern(startDate, endDate);
  }

  private buildPattern(startStr: string, endStr: string): RegExp {
    const start = this.parseDate(startStr);
    const end = this.parseDate(endStr);
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
    ];
    return new RegExp(alternatives.join("|"));
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
