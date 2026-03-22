declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import {
  findEmployeeWithVacationDays,
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
 * TC-VAC-060: Verify administrative vacation does not deduct days.
 * Create 3-day unpaid vacation, verify available days unchanged.
 */
export class VacationTc060Data {
  readonly username: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;
  readonly expectedAdminDays: number;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc060Data> {
    if (mode === "static") return new VacationTc060Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithVacationDays(db, 0);
      const range = await VacationTc060Data.findAvailableRange(db, username);
      return new VacationTc060Data(username, range.start, range.end, range.workingDays);
    } finally {
      await db.close();
    }
  }

  private static async findAvailableRange(
    db: DbClient,
    login: string,
  ): Promise<{ start: string; end: string; workingDays: number }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + 14);

    for (let attempt = 0; attempt < 16; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      // 3 working days: Mon-Wed
      const end = new Date(start);
      end.setDate(start.getDate() + 2);

      const startIso = VacationTc060Data.toIso(start);
      const endIso = VacationTc060Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return {
          start: VacationTc060Data.toDdMmYyyy(start),
          end: VacationTc060Data.toDdMmYyyy(end),
          workingDays: 3,
        };
      }
    }
    throw new Error(
      `No conflict-free Mon-Wed window for "${login}" within 16 weeks`,
    );
  }

  private static toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private static toDdMmYyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  constructor(
    username = process.env.VACATION_TC060_USERNAME ?? "amelnikova",
    startDate = process.env.VACATION_TC060_START ?? "13.04.2026",
    endDate = process.env.VACATION_TC060_END ?? "15.04.2026",
    expectedAdminDays = 3,
  ) {
    this.username = username;
    this.startDate = startDate;
    this.endDate = endDate;
    this.expectedAdminDays = expectedAdminDays;
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
    ];
    return new RegExp(alternatives.join("|"));
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
