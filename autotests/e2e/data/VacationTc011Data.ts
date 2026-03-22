declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithMultiYearBalance } from "./queries/vacationQueries";

/**
 * TC-VAC-011: Verify available vacation days display and yearly breakdown.
 * Read-only — finds an employee with vacation balance in 2+ years.
 */
export class VacationTc011Data {
  readonly username: string;
  readonly expectedEntries: { year: number; days: number }[];

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc011Data> {
    if (mode === "static") return new VacationTc011Data();

    const db = new DbClient(tttConfig);
    try {
      const { login, entries } = await findEmployeeWithMultiYearBalance(db);
      return new VacationTc011Data(login, entries);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC011_USERNAME ?? "pvaynmaster",
    expectedEntries: { year: number; days: number }[] = [
      { year: 2026, days: 4 },
      { year: 2027, days: 24 },
    ],
  ) {
    this.username = username;
    this.expectedEntries = expectedEntries;
  }
}
