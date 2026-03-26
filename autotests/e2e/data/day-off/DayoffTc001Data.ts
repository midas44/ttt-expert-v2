declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithDayoffs } from "./queries/dayoffQueries";

interface Tc001Args {
  username: string;
}

/**
 * TC-DO-001: View day-off list for current year.
 * Needs an employee whose salary office has public holidays configured.
 */
export class DayoffTc001Data {
  readonly username: string;

  constructor(username = process.env.DAYOFF_TC001_USER ?? "ddergachev") {
    this.username = username;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc001Data> {
    if (mode === "static") return new DayoffTc001Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc001Args>("DayoffTc001Data");
      if (cached) return new DayoffTc001Data(cached.username);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithDayoffs(db);
      const instance = new DayoffTc001Data(row.login);
      if (mode === "saved")
        saveToDisk("DayoffTc001Data", { username: row.login });
      return instance;
    } finally {
      await db.close();
    }
  }
}
