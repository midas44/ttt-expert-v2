declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeByActiveCalendar } from "./queries/dayoffQueries";

interface Tc007Args {
  username: string;
  expectedHolidayCount: number;
}

/**
 * TC-DO-007: Verify holidays per salary office — Russia.
 * Finds an employee whose office's active calendar is Russia,
 * returns the expected holiday count from the production calendar.
 */
export class DayoffTc007Data {
  readonly username: string;
  readonly expectedHolidayCount: number;

  /** Subset of Russian holiday reason patterns to verify in the table. */
  readonly expectedReasonPatterns = [
    /новый год/i,
    /день защитника/i,
    /женский день/i,
    /день труда/i,
    /день победы/i,
    /день россии/i,
    /народного единства/i,
  ];

  constructor(
    username = process.env.DAYOFF_TC007_USER ?? "azaikov",
    expectedHolidayCount = Number(
      process.env.DAYOFF_TC007_COUNT ?? "18",
    ),
  ) {
    this.username = username;
    this.expectedHolidayCount = expectedHolidayCount;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc007Data> {
    if (mode === "static") return new DayoffTc007Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc007Args>("DayoffTc007Data");
      if (cached)
        return new DayoffTc007Data(
          cached.username,
          cached.expectedHolidayCount,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeByActiveCalendar(db, "Russia");
      const instance = new DayoffTc007Data(row.login, row.expectedCount);
        saveToDisk("DayoffTc007Data", {
          username: row.login,
          expectedHolidayCount: row.expectedCount,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
