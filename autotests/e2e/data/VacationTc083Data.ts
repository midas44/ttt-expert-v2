declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithVacationDays } from "./queries/vacationQueries";

/**
 * TC-VAC-083: Start date in the past — error message.
 * Sets start date to yesterday, end date to tomorrow.
 * Expects validation error preventing creation.
 */
export class VacationTc083Data {
  readonly username: string;
  readonly startDate: string; // dd.mm.yyyy — yesterday
  readonly endDate: string;   // dd.mm.yyyy — tomorrow

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc083Data> {
    if (mode === "static") return new VacationTc083Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithVacationDays(db, 2);
      return new VacationTc083Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC083_USERNAME ?? "pvaynmaster",
  ) {
    this.username = username;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.startDate = VacationTc083Data.toDdMmYyyy(yesterday);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.endDate = VacationTc083Data.toDdMmYyyy(tomorrow);
  }

  private static toDdMmYyyy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }
}
