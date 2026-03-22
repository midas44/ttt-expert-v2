declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithMultipleVacations } from "./queries/vacationQueries";

/**
 * TC-VAC-008: Verify vacation table columns and sorting.
 * Read-only — finds an employee with 3+ vacation records.
 */
export class VacationTc008Data {
  readonly username: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc008Data> {
    if (mode === "static") return new VacationTc008Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithMultipleVacations(db, 3);
      return new VacationTc008Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC008_USERNAME ?? "pvaynmaster",
  ) {
    this.username = username;
  }
}
