declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc006Args {
  username: string;
  currentYear: number;
  previousYear: number;
}

/**
 * TC-DO-006: Year selector changes displayed holidays.
 *
 * Finds an employee whose office has calendar entries for both the
 * current year and the previous year, so the test can switch years
 * and verify the table reloads.
 */
export class DayoffTc006Data {
  readonly username: string;
  readonly currentYear: number;
  readonly previousYear: number;

  constructor(
    username = process.env.DAYOFF_TC006_USER ?? "ddergachev",
    currentYear = new Date().getFullYear(),
    previousYear = new Date().getFullYear() - 1,
  ) {
    this.username = username;
    this.currentYear = currentYear;
    this.previousYear = previousYear;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc006Data> {
    if (mode === "static") return new DayoffTc006Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc006Args>("DayoffTc006Data");
      if (cached)
        return new DayoffTc006Data(
          cached.username,
          cached.currentYear,
          cached.previousYear,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      const row = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         JOIN ttt_calendar.office_calendar oc ON oc.office_id = e.office_id
         JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = oc.calendar_id
         WHERE e.enabled = true
           AND cd.duration = 0
         GROUP BY e.login
         HAVING COUNT(DISTINCT EXTRACT(YEAR FROM cd.calendar_date))
                  FILTER (WHERE EXTRACT(YEAR FROM cd.calendar_date) IN ($1, $2)) = 2
         ORDER BY random()
         LIMIT 1`,
        [currentYear, previousYear],
      );

      const instance = new DayoffTc006Data(
        row.login,
        currentYear,
        previousYear,
      );

      if (mode === "saved")
        saveToDisk("DayoffTc006Data", {
          username: row.login,
          currentYear,
          previousYear,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
