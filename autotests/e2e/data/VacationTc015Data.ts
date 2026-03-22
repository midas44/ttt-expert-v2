declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import {
  findEmployeeWithVacationDays,
  hasVacationConflict,
} from "./queries/vacationQueries";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * TC-VAC-015: Verify payment month auto-calculation.
 * Opens the create dialog, sets dates, verifies payment month auto-populates.
 * Does NOT save — dialog is cancelled after verification.
 */
export class VacationTc015Data {
  readonly username: string;
  readonly startDate: string;
  readonly endDate: string;
  /** Expected payment month in dd.mm.yyyy format (1st day of start date's month). */
  readonly expectedPaymentMonth: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc015Data> {
    if (mode === "static") return new VacationTc015Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithVacationDays(db, 5);
      const { startDate, endDate } =
        await VacationTc015Data.findAvailableDates(db, username);
      return new VacationTc015Data(username, startDate, endDate);
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
    // Start 2 weeks from now to ensure payment month is clearly deterministic
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + 7);

    for (let attempt = 0; attempt < 12; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

      const startIso = VacationTc015Data.toIso(start);
      const endIso = VacationTc015Data.toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return {
          startDate: VacationTc015Data.toDdMmYyyy(start),
          endDate: VacationTc015Data.toDdMmYyyy(end),
        };
      }
    }
    throw new Error(
      `Could not find a conflict-free Mon–Fri window for "${login}" within 12 weeks`,
    );
  }

  private static toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private static toDdMmYyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }

  constructor(
    username = process.env.VACATION_TC015_USERNAME ?? "amelnikova",
    startDate = process.env.VACATION_TC015_START_DATE ?? "13.04.2026",
    endDate = process.env.VACATION_TC015_END_DATE ?? "17.04.2026",
  ) {
    this.username = username;
    this.startDate = startDate;
    this.endDate = endDate;
    this.expectedPaymentMonth = this.computeExpectedPaymentMonth();
  }

  private computeExpectedPaymentMonth(): string {
    const d = this.parseDate(this.startDate);
    // Payment month = 1st day of the start date's month in dd.mm.yyyy format
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `01.${mm}.${d.getUTCFullYear()}`;
  }

  /** Returns month name of the start date (e.g., "April"). */
  get startMonthName(): string {
    const d = this.parseDate(this.startDate);
    return MONTH_NAMES[d.getUTCMonth()];
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
