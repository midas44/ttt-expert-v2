declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findPastDayoffInOpenPeriod,
  getApprovePeriodStart,
} from "./queries/t3404Queries";

interface Tc011Args {
  username: string;
  dayoffDate: string;
  approvePeriodStart: string;
}

/**
 * TC-T3404-011: Closed month (February) — all dates disabled in datepicker.
 * Needs an employee with an editable day-off so we can open the reschedule
 * dialog and navigate backward to February.
 */
export class T3404Tc011Data {
  readonly username: string;
  readonly dayoffDate: string;
  readonly approvePeriodStart: string;

  constructor(
    username = process.env.T3404_TC011_USER ?? "eburets",
    dayoffDate = process.env.T3404_TC011_DATE ?? "2026-03-09",
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

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc011Data> {
    if (mode === "static") return new T3404Tc011Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc011Args>("T3404Tc011Data");
      if (cached)
        return new T3404Tc011Data(
          cached.username,
          cached.dayoffDate,
          cached.approvePeriodStart,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPastDayoffInOpenPeriod(db);
      const apStart = await getApprovePeriodStart(db);
      const instance = new T3404Tc011Data(row.login, row.date, apStart);
        saveToDisk("T3404Tc011Data", {
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
