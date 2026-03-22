declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithOpenAndClosedVacations } from "./queries/vacationQueries";

/**
 * TC-VAC-010: Verify Open/Closed/All filter tabs.
 * Read-only — finds an employee with both open and closed vacations.
 */
export class VacationTc010Data {
  readonly username: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc010Data> {
    if (mode === "static") return new VacationTc010Data();

    const db = new DbClient(tttConfig);
    try {
      const username = await findEmployeeWithOpenAndClosedVacations(db);
      return new VacationTc010Data(username);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC010_USERNAME ?? "amelnikova",
  ) {
    this.username = username;
  }
}
