declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithMultipleVacations } from "./queries/vacationQueries";

/**
 * TC-VAC-012: Verify total row in vacation table.
 * Read-only — finds an employee with 2+ vacation records.
 */
export class VacationTc012Data {
  readonly username: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc012Data> {
    if (mode === "static") return new VacationTc012Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithMultipleVacations(db, 2);
      return new VacationTc012Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC012_USERNAME ?? "pvaynmaster",
  ) {
    this.username = username;
  }
}
