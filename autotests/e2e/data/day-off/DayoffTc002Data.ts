declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithDayoffs } from "./queries/dayoffQueries";

interface Tc002Args {
  username: string;
}

/**
 * TC-DO-002: Navigate to Days off tab from Vacations tab.
 * Needs any logged-in employee (with calendar for verification).
 */
export class DayoffTc002Data {
  readonly username: string;

  constructor(username = process.env.DAYOFF_TC002_USER ?? "asmirnov") {
    this.username = username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc002Data> {
    if (mode === "static") return new DayoffTc002Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc002Args>("DayoffTc002Data");
      if (cached) return new DayoffTc002Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithDayoffs(db);
      const instance = new DayoffTc002Data(row.login);
        saveToDisk("DayoffTc002Data", { username: row.login });
      return instance;
    } finally {
      await db.close();
    }
  }
}
