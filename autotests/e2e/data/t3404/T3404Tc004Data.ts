declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findFutureDayoffInOpenPeriod } from "./queries/t3404Queries";

interface Tc004Args {
  username: string;
  dayoffDate: string;
}

/**
 * TC-T3404-004: Edit icon visible for future day-off in open month (baseline).
 * Needs an employee with a future day-off (after today) in the open approve period.
 */
export class T3404Tc004Data {
  readonly username: string;
  readonly dayoffDate: string;

  constructor(
    username = process.env.T3404_TC004_USER ?? "eburets",
    dayoffDate = "2026-05-01",
  ) {
    this.username = username;
    this.dayoffDate = dayoffDate;
  }

  get dateDisplay(): string {
    const [y, m, d] = this.dayoffDate.split("-");
    return `${d}.${m}.${y}`;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc004Data> {
    if (mode === "static") return new T3404Tc004Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc004Args>("T3404Tc004Data");
      if (cached) return new T3404Tc004Data(cached.username, cached.dayoffDate);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findFutureDayoffInOpenPeriod(db);
      const instance = new T3404Tc004Data(row.login, row.date);
        saveToDisk("T3404Tc004Data", {
          username: row.login,
          dayoffDate: row.date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
