declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import {
  findEmployeeWithColleague,
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
 * TC-VAC-004: Create vacation with "Also notify" colleagues.
 * Finds an employee + colleague in the same office for the notify field.
 */
export class VacationTc004Data {
  readonly username: string;
  readonly colleagueLogin: string;
  readonly colleagueName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;
  readonly expectedStatus = "New";
  readonly notificationText =
    "A new vacation request has been created";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc004Data> {
    if (mode === "static") return new VacationTc004Data();

    const db = new DbClient(tttConfig);
    try {
      const { creator_login, colleague_login, colleague_name } =
        await findEmployeeWithColleague(db, 5);
      const { startDate, endDate } =
        await VacationTc004Data.findAvailableDates(db, creator_login);
      return new VacationTc004Data(
        creator_login,
        colleague_login,
        colleague_name,
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

      const startIso = VacationTc004Data.toIso(start);
      const endIso = VacationTc004Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return {
          startDate: VacationTc004Data.toDdMmYyyy(start),
          endDate: VacationTc004Data.toDdMmYyyy(end),
        };
      }
    }
    throw new Error(
      `Could not find a conflict-free Mon–Fri window for "${login}" within 12 weeks`,
    );
  }

  /** Returns ISO date (YYYY-MM-DD) for start/end date used in DB verification. */
  startDateIso(): string {
    return VacationTc004Data.ddmmyyyyToIso(this.startDate);
  }

  endDateIso(): string {
    return VacationTc004Data.ddmmyyyyToIso(this.endDate);
  }

  private static ddmmyyyyToIso(dateStr: string): string {
    const [dd, mm, yyyy] = dateStr.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }

  private static toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private static toDdMmYyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  constructor(
    username = process.env.VACATION_TC004_USERNAME ?? "amelnikova",
    colleagueLogin = process.env.VACATION_TC004_COLLEAGUE ?? "pvaynmaster",
    colleagueName = process.env.VACATION_TC004_COLLEAGUE_NAME ?? "Pavel Weinmeister",
    startDate = process.env.VACATION_TC004_START_DATE ?? "07.04.2026",
    endDate = process.env.VACATION_TC004_END_DATE ?? "10.04.2026",
  ) {
    this.username = username;
    this.colleagueLogin = colleagueLogin;
    this.colleagueName = colleagueName;
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
    ];
    return new RegExp(alternatives.join("|"));
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
