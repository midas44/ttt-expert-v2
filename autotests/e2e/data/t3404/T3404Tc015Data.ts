declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findPastDayoffInOpenPeriod,
  getApprovePeriodStart,
} from "./queries/t3404Queries";

interface Tc015Args {
  username: string;
  dayoffDate: string;
  approvePeriodStart: string;
}

/**
 * TC-T3404-015: Boundary — March 2 (first working day of open period) is enabled.
 * March 1 is Sunday, March 2 is Monday. With approvePeriod starting 2026-03-01,
 * March 2 should be the first selectable working day.
 */
export class T3404Tc015Data {
  readonly username: string;
  readonly dayoffDate: string;
  readonly approvePeriodStart: string;

  constructor(
    username = process.env.T3404_TC015_USER ?? "eburets",
    dayoffDate = process.env.T3404_TC015_DATE ?? "2026-03-09",
    approvePeriodStart = "2026-03-01",
  ) {
    this.username = username;
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

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc015Data> {
    if (mode === "static") return new T3404Tc015Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc015Args>("T3404Tc015Data");
      if (cached)
        return new T3404Tc015Data(
          cached.username,
          cached.dayoffDate,
          cached.approvePeriodStart,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPastDayoffInOpenPeriod(db);
      const apStart = await getApprovePeriodStart(db);
      const instance = new T3404Tc015Data(row.login, row.date, apStart);
      if (mode === "saved")
        saveToDisk("T3404Tc015Data", {
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
