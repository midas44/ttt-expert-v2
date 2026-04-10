declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findPastDayoffInOpenPeriod,
  getApprovePeriodStart,
} from "./queries/t3404Queries";

interface Tc016Args {
  username: string;
  dayoffDate: string;
  approvePeriodStart: string;
}

/**
 * TC-T3404-016: Select earlier date within same month (core new behavior).
 * Needs an employee with a past day-off in open period that can be rescheduled
 * to an earlier date within the same month.
 */
export class T3404Tc016Data {
  readonly username: string;
  readonly dayoffDate: string;
  readonly approvePeriodStart: string;

  constructor(
    username = process.env.T3404_TC016_USER ?? "eburets",
    dayoffDate = process.env.T3404_TC016_DATE ?? "2026-03-09",
    approvePeriodStart = "2026-03-01",
  ) {
    this.username = username;
    this.dayoffDate = dayoffDate;
    this.approvePeriodStart = approvePeriodStart;
  }

  /** Returns the day-off date in DD.MM.YYYY format. */
  get dateDisplay(): string {
    const [y, m, d] = this.dayoffDate.split("-");
    return `${d}.${m}.${y}`;
  }

  /** Returns the month (0-indexed) and year for calendar navigation. */
  get calendarMonth(): number {
    return parseInt(this.dayoffDate.split("-")[1], 10) - 1;
  }

  get calendarYear(): number {
    return parseInt(this.dayoffDate.split("-")[0], 10);
  }

  /**
   * Returns day number of the first working day of the month
   * (approximate — March 2 since March 1 is Sunday in 2026).
   */
  get firstWorkingDayOfMonth(): number {
    const month = parseInt(this.dayoffDate.split("-")[1], 10);
    // March 2026: 1st is Sunday, 2nd is Monday
    if (month === 3) return 2;
    // Default: assume 1st may be workday
    return 2;
  }

  /** Returns the original day-off day number. */
  get dayoffDay(): number {
    return parseInt(this.dayoffDate.split("-")[2], 10);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc016Data> {
    if (mode === "static") return new T3404Tc016Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc016Args>("T3404Tc016Data");
      if (cached)
        return new T3404Tc016Data(
          cached.username,
          cached.dayoffDate,
          cached.approvePeriodStart,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPastDayoffInOpenPeriod(db);
      const apStart = await getApprovePeriodStart(db);
      const instance = new T3404Tc016Data(row.login, row.date, apStart);
        saveToDisk("T3404Tc016Data", {
          username: row.login,
          dayoffDate: row.date,
          approvePeriodStart: apStart,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
