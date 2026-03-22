declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findRandomEmployee } from "./queries/vacationQueries";

/**
 * TC-VAC-084: End date before start date — error message.
 * Sets start date 2 weeks from now, end date 1 week from now (before start).
 * Expects validation error preventing creation.
 */
export class VacationTc084Data {
  readonly username: string;
  readonly startDate: string; // dd.mm.yyyy — 2 weeks from now
  readonly endDate: string;   // dd.mm.yyyy — 1 week from now (before start)

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc084Data> {
    if (mode === "static") return new VacationTc084Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findRandomEmployee(db);
      return new VacationTc084Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC084_USERNAME ?? "pvaynmaster",
  ) {
    this.username = username;

    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    this.startDate = VacationTc084Data.toDdMmYyyy(twoWeeks);

    const oneWeek = new Date();
    oneWeek.setDate(oneWeek.getDate() + 7);
    this.endDate = VacationTc084Data.toDdMmYyyy(oneWeek);
  }

  private static toDdMmYyyy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }
}
