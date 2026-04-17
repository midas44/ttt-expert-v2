declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findDayoffInClosedPeriod } from "./queries/t3404Queries";

interface Tc006Args {
  username: string;
  closedDate: string;
}

/**
 * TC-T3404-006: Edit icon HIDDEN for day-off in closed month.
 * Needs an employee with a day-off in a month before the approve period start.
 */
export class T3404Tc006Data {
  readonly username: string;
  readonly closedDate: string;

  constructor(
    username = process.env.T3404_TC006_USER ?? "eburets",
    closedDate = "2026-02-23",
  ) {
    this.username = username;
    this.closedDate = closedDate;
  }

  /** Returns the date in DD.MM.YYYY format for table matching. */
  get dateDisplay(): string {
    const [y, m, d] = this.closedDate.split("-");
    return `${d}.${m}.${y}`;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc006Data> {
    if (mode === "static") return new T3404Tc006Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc006Args>("T3404Tc006Data");
      if (cached) return new T3404Tc006Data(cached.username, cached.closedDate);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findDayoffInClosedPeriod(db);
      const instance = new T3404Tc006Data(row.login, row.date);
        saveToDisk("T3404Tc006Data", {
          username: row.login,
          closedDate: row.date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
