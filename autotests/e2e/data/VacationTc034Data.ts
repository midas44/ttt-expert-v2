declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import {
  findEmployeeWithManager,
  hasVacationConflict,
} from "./queries/vacationQueries";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * TC-VAC-034: Reject APPROVED vacation.
 * Self-contained: creates vacation → manager approves → manager rejects the approved vacation.
 */
export class VacationTc034Data {
  readonly employeeLogin: string;
  readonly managerLogin: string;
  readonly employeeName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc034Data> {
    if (mode === "static") return new VacationTc034Data();

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithManager(db, 5);
      const range = await VacationTc034Data.findAvailableRange(
        db,
        emp.employee_login,
      );
      return new VacationTc034Data(
        emp.employee_login,
        emp.manager_login,
        emp.employee_name,
        range.start,
        range.end,
      );
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
    monday.setDate(now.getDate() + daysUntilMonday);

    for (let attempt = 0; attempt < 16; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

      const startIso = VacationTc034Data.toIso(start);
      const endIso = VacationTc034Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return {
          start: VacationTc034Data.toDdMmYyyy(start),
          end: VacationTc034Data.toDdMmYyyy(end),
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
    employeeLogin = process.env.VACATION_TC034_EMPLOYEE ?? "amelnikova",
    managerLogin = process.env.VACATION_TC034_MANAGER ?? "pvaynmaster",
    employeeName = "Anna Melnikova",
    startDate = process.env.VACATION_TC034_START ?? "14.04.2026",
    endDate = process.env.VACATION_TC034_END ?? "17.04.2026",
  ) {
    this.employeeLogin = employeeLogin;
    this.managerLogin = managerLogin;
    this.employeeName = employeeName;
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
