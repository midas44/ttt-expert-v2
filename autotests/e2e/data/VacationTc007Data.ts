declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithVacation } from "./queries/vacationQueries";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * TC-VAC-007: Edit APPROVED vacation — status resets to NEW.
 * Finds an existing APPROVED future vacation and edits its end date.
 */
export class VacationTc007Data {
  readonly username: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly originalPeriodPattern: RegExp;
  readonly newEndDate: string;
  readonly editedPeriodPattern: RegExp;
  readonly expectedStatusAfterEdit = "New";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc007Data> {
    if (mode === "static") return new VacationTc007Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithVacation(db, "APPROVED", true, 2);
      const start = VacationTc007Data.isoToDdMmYyyy(row.start_date);
      const end = VacationTc007Data.isoToDdMmYyyy(row.end_date);
      const newEnd = VacationTc007Data.addDays(row.end_date, 1);
      return new VacationTc007Data(row.login, start, end, newEnd);
    } finally {
      await db.close();
    }
  }

  private static isoToDdMmYyyy(iso: string): string {
    const [year, month, day] = iso.split("-");
    return `${day}.${month}.${year}`;
  }

  private static addDays(iso: string, days: number): string {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getUTCFullYear()}`;
  }

  constructor(
    username = process.env.VACATION_TC007_USERNAME ?? "inazarova",
    startDate = process.env.VACATION_TC007_START_DATE ?? "31.08.2026",
    endDate = process.env.VACATION_TC007_END_DATE ?? "11.09.2026",
    newEndDate = process.env.VACATION_TC007_NEW_END ?? "12.09.2026",
  ) {
    this.username = username;
    this.startDate = startDate;
    this.endDate = endDate;
    this.newEndDate = newEndDate;
    this.originalPeriodPattern = this.buildPattern(startDate, endDate);
    this.editedPeriodPattern = this.buildPattern(startDate, newEndDate);
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
