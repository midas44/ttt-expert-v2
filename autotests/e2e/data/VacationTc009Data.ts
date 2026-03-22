declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithMixedTypeVacations } from "./queries/vacationQueries";

/**
 * TC-VAC-009: Verify vacation table filters — status and type.
 * Read-only — finds an employee with both Regular and Administrative vacations.
 */
export class VacationTc009Data {
  readonly username: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc009Data> {
    if (mode === "static") return new VacationTc009Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithMixedTypeVacations(db);
      return new VacationTc009Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC009_USERNAME ?? "pvaynmaster",
  ) {
    this.username = username;
  }
}
