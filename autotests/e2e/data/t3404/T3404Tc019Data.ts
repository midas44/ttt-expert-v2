declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findFutureMidMonthDayoff } from "./queries/t3404Queries";

interface Tc019Args {
  username: string;
  dayoffDate: string;
}

/**
 * TC-T3404-019: Future holiday — minDate still uses original date (ST-4).
 * Needs a future day-off on day >= 5 of a month, so there are earlier working
 * days in the same month that should be disabled (minDate = originalDate).
 */
export class T3404Tc019Data {
  readonly username: string;
  readonly dayoffDate: string;

  constructor(
    username = process.env.T3404_TC019_USER ?? "eburets",
    dayoffDate = "2026-05-09",
  ) {
    this.username = username;
    this.dayoffDate = dayoffDate;
  }

  get dateDisplay(): string {
    const [y, m, d] = this.dayoffDate.split("-");
    return `${d}.${m}.${y}`;
  }

  get calendarMonth(): number {
    return parseInt(this.dayoffDate.split("-")[1], 10) - 1;
  }

  get calendarYear(): number {
    return parseInt(this.dayoffDate.split("-")[0], 10);
  }

  /** The day number of the day-off (e.g., 9 for May 9). */
  get dayoffDay(): number {
    return parseInt(this.dayoffDate.split("-")[2], 10);
  }

  /**
   * A working day BEFORE the day-off day in the same month.
   * Used to verify it is disabled (minDate = originalDate for future holidays).
   * We pick day 2 as a safe working day candidate (day 1 may be a holiday).
   */
  get earlierDayInMonth(): number {
    return Math.max(2, this.dayoffDay - 3);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc019Data> {
    if (mode === "static") return new T3404Tc019Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc019Args>("T3404Tc019Data");
      if (cached)
        return new T3404Tc019Data(cached.username, cached.dayoffDate);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findFutureMidMonthDayoff(db);
      const instance = new T3404Tc019Data(row.login, row.date);
        saveToDisk("T3404Tc019Data", {
          username: row.login,
          dayoffDate: row.date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
