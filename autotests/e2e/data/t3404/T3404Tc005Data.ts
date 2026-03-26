declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findPastDayoffInOpenPeriod } from "./queries/t3404Queries";

interface Tc005Args {
  username: string;
  dayoffDate: string;
}

/**
 * TC-T3404-005: Edit icon visible for PAST day-off in open month (core new behavior).
 * Needs an employee with a day-off whose date is past but within the open approve period.
 */
export class T3404Tc005Data {
  readonly username: string;
  readonly dayoffDate: string;

  constructor(
    username = process.env.T3404_TC005_USER ?? "eburets",
    dayoffDate = process.env.T3404_TC005_DATE ?? "2026-03-09",
  ) {
    this.username = username;
    this.dayoffDate = dayoffDate;
  }

  /** Returns the date in DD.MM.YYYY format for table matching. */
  get dateDisplay(): string {
    const [y, m, d] = this.dayoffDate.split("-");
    return `${d}.${m}.${y}`;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc005Data> {
    if (mode === "static") return new T3404Tc005Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc005Args>("T3404Tc005Data");
      if (cached) return new T3404Tc005Data(cached.username, cached.dayoffDate);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPastDayoffInOpenPeriod(db);
      const instance = new T3404Tc005Data(row.login, row.date);
      if (mode === "saved")
        saveToDisk("T3404Tc005Data", {
          username: row.login,
          dayoffDate: row.date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
