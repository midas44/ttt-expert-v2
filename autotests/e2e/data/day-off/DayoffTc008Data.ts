declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeByActiveCalendar } from "./queries/dayoffQueries";

interface Tc008Args {
  username: string;
  expectedHolidayCount: number;
}

/**
 * TC-DO-008: Verify holidays per salary office — Cyprus.
 * Finds an employee whose office's active calendar is Cyprus,
 * returns the expected holiday count from the production calendar.
 */
export class DayoffTc008Data {
  readonly username: string;
  readonly expectedHolidayCount: number;

  constructor(
    username = process.env.DAYOFF_TC008_USER ?? "nkudratov",
    expectedHolidayCount = Number(
      process.env.DAYOFF_TC008_COUNT ?? "12",
    ),
  ) {
    this.username = username;
    this.expectedHolidayCount = expectedHolidayCount;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc008Data> {
    if (mode === "static") return new DayoffTc008Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc008Args>("DayoffTc008Data");
      if (cached)
        return new DayoffTc008Data(
          cached.username,
          cached.expectedHolidayCount,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeByActiveCalendar(db, "Cyprus");
      const instance = new DayoffTc008Data(row.login, row.expectedCount);
      if (mode === "saved")
        saveToDisk("DayoffTc008Data", {
          username: row.login,
          expectedHolidayCount: row.expectedCount,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
