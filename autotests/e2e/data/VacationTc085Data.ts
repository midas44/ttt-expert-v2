declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithVacationDays } from "./queries/vacationQueries";

/**
 * TC-VAC-085: Next year vacation before Feb 1 — error.
 * Sets server clock to Jan 15, then tries to create a vacation
 * in the next year. Should fail with validation.vacation.next.year.not.available.
 */
export class VacationTc085Data {
  readonly username: string;
  readonly startDate: string; // dd.mm.yyyy — a Monday in Jan of clockYear+1
  readonly endDate: string;   // dd.mm.yyyy — the following Friday
  readonly clockTime: string; // ISO datetime for PATCH /api/ttt/v1/test/clock

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc085Data> {
    if (mode === "static") return new VacationTc085Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithVacationDays(db, 2);
      return new VacationTc085Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC085_USERNAME ?? "pvaynmaster",
  ) {
    this.username = username;

    const clockYear = new Date().getFullYear();
    this.clockTime = `${clockYear}-01-15T12:00:00`;

    // Next year dates: find a Monday in January of clockYear+1
    const nextYear = clockYear + 1;
    const start = new Date(nextYear, 0, 12); // Jan 12
    while (start.getDay() !== 1) start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 4); // Friday

    this.startDate = VacationTc085Data.toDdMmYyyy(start);
    this.endDate = VacationTc085Data.toDdMmYyyy(end);
  }

  private static toDdMmYyyy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }
}
