declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithVacationDays } from "./queries/vacationQueries";

/**
 * TC-VAC-086: Vacation with 0 working days (Sat-Sun only) — duration error.
 * Selects start = next Saturday, end = next Sunday.
 * Number of days = 0, which is below minimalVacationDuration (1).
 */
export class VacationTc086Data {
  readonly username: string;
  readonly startDate: string; // dd.mm.yyyy — next Saturday
  readonly endDate: string;   // dd.mm.yyyy — next Sunday

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc086Data> {
    if (mode === "static") return new VacationTc086Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithVacationDays(db, 2);
      return new VacationTc086Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC086_USERNAME ?? "pvaynmaster",
  ) {
    this.username = username;

    // Find the next Saturday (at least 1 week out to avoid "past date" issues)
    const now = new Date();
    const sat = new Date(now);
    sat.setDate(now.getDate() + 7); // at least 1 week ahead
    while (sat.getDay() !== 6) sat.setDate(sat.getDate() + 1);

    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);

    this.startDate = VacationTc086Data.toDdMmYyyy(sat);
    this.endDate = VacationTc086Data.toDdMmYyyy(sun);
  }

  private static toDdMmYyyy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }
}
