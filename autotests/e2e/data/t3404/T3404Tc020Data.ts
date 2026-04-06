declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findPastDayoffWithManager,
  getApprovePeriodStart,
} from "./queries/t3404Queries";

interface Tc020Args {
  username: string;
  managerLogin: string;
  dayoffDate: string;
  approvePeriodStart: string;
}

/**
 * TC-T3404-020: E2E full reschedule to earlier date + approval flow.
 * Needs an employee with a past day-off in the open period AND their manager.
 * The employee creates a backward transfer; the manager approves it.
 */
export class T3404Tc020Data {
  readonly username: string;
  readonly managerLogin: string;
  readonly dayoffDate: string;
  readonly approvePeriodStart: string;

  constructor(
    username = process.env.T3404_TC020_USER ?? "eburets",
    managerLogin = process.env.T3404_TC020_MGR ?? "pvaynmaster",
    dayoffDate = "2026-03-09",
    approvePeriodStart = "2026-03-01",
  ) {
    this.username = username;
    this.managerLogin = managerLogin;
    this.dayoffDate = dayoffDate;
    this.approvePeriodStart = approvePeriodStart;
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

  get dayoffDay(): number {
    return parseInt(this.dayoffDate.split("-")[2], 10);
  }

  /**
   * Compute a target earlier working day for the transfer.
   * We pick first working day of the month (e.g., March 2 since March 1 is Sunday).
   */
  get targetEarlierDay(): number {
    const apStartDay = parseInt(this.approvePeriodStart.split("-")[2], 10);
    // Start from approve period start day, skip weekends
    // For March 2026: March 1 = Sunday, so first working day is March 2
    return apStartDay + 1; // Safe fallback: 2nd day of month
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc020Data> {
    if (mode === "static") return new T3404Tc020Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc020Args>("T3404Tc020Data");
      if (cached)
        return new T3404Tc020Data(
          cached.username,
          cached.managerLogin,
          cached.dayoffDate,
          cached.approvePeriodStart,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPastDayoffWithManager(db);
      const apStart = await getApprovePeriodStart(db);
      const instance = new T3404Tc020Data(
        row.login,
        row.manager_login,
        row.date,
        apStart,
      );
        saveToDisk("T3404Tc020Data", {
          username: row.login,
          managerLogin: row.manager_login,
          dayoffDate: row.date,
          approvePeriodStart: apStart,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
