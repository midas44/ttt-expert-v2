declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import {
  findNonCpoEmployeeWithManager,
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
 * TC-VAC-017: Create vacation with optional approvers.
 * Finds a non-CPO employee with a manager and sufficient vacation days.
 */
export class VacationTc017Data {
  readonly employeeLogin: string;
  readonly managerLogin: string;
  readonly employeeName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;
  readonly comment: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc017Data> {
    if (mode === "static") return new VacationTc017Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await findNonCpoEmployeeWithManager(db, 5);
      const { startDate, endDate } =
        await VacationTc017Data.findAvailableDates(db, row.employee_login);
      return new VacationTc017Data(
        row.employee_login,
        row.manager_login,
        row.employee_name,
        startDate,
        endDate,
      );
    } finally {
      await db.close();
    }
  }

  private static async findAvailableDates(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; endDate: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);

    for (let attempt = 0; attempt < 12; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

      const startIso = VacationTc017Data.toIso(start);
      const endIso = VacationTc017Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return {
          startDate: VacationTc017Data.toDdMmYyyy(start),
          endDate: VacationTc017Data.toDdMmYyyy(end),
        };
      }
    }
    throw new Error(
      `Could not find a conflict-free Mon-Fri window for "${login}" within 12 weeks`,
    );
  }

  private static toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  private static toDdMmYyyy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }

  constructor(
    employeeLogin = process.env.VACATION_TC017_EMP_LOGIN ?? "amelnikova",
    managerLogin = process.env.VACATION_TC017_MGR_LOGIN ?? "pvaynmaster",
    employeeName = process.env.VACATION_TC017_EMP_NAME ?? "Anna Melnikova",
    startDate = process.env.VACATION_TC017_START_DATE ?? "13.04.2026",
    endDate = process.env.VACATION_TC017_END_DATE ?? "17.04.2026",
  ) {
    this.employeeLogin = employeeLogin;
    this.managerLogin = managerLogin;
    this.employeeName = employeeName;
    this.startDate = startDate;
    this.endDate = endDate;
    this.comment = `autotest tc017 ${this.formatTimestamp()}`;
    this.periodPattern = this.buildPeriodPattern();
  }

  private formatTimestamp(date: Date = new Date()): string {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${dd}${mm}${yy}_${hh}${min}`;
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
    ];
    return new RegExp(alternatives.join("|"));
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
