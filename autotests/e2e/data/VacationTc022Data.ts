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
 * TC-VAC-022: Cancel APPROVED vacation.
 * Finds an existing APPROVED future vacation and cancels it.
 */
export class VacationTc022Data {
  readonly username: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;
  readonly expectedStatusAfterCancel = "Canceled";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc022Data> {
    if (mode === "static") return new VacationTc022Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithVacation(db, "APPROVED", true);
      const start = VacationTc022Data.isoToDdMmYyyy(row.start_date);
      const end = VacationTc022Data.isoToDdMmYyyy(row.end_date);
      return new VacationTc022Data(row.login, start, end);
    } finally {
      await db.close();
    }
  }

  private static isoToDdMmYyyy(iso: string): string {
    const [year, month, day] = iso.split("-");
    return `${day}.${month}.${year}`;
  }

  constructor(
    username = process.env.VACATION_TC022_USERNAME ?? "ozarubina",
    startDate = process.env.VACATION_TC022_START_DATE ?? "29.06.2026",
    endDate = process.env.VACATION_TC022_END_DATE ?? "10.07.2026",
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
    ];
    return new RegExp(alternatives.join("|"));
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
