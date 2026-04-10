declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithFutureAndPastHolidays } from "./queries/dayoffQueries";

interface Tc011Args {
  username: string;
  futureDate: string;
  pastDate: string;
}

/**
 * TC-DO-011: Edit button visibility — only on future dates with duration=0.
 *
 * Finds an employee who has both a future public holiday (d=0, no active
 * transfer) and a past holiday. The spec verifies edit button is present
 * on the future row and absent on the past row.
 */
export class DayoffTc011Data {
  readonly username: string;
  readonly futureDate: string;
  readonly pastDate: string;

  constructor(
    username = process.env.DAYOFF_TC011_USER ?? "ddergachev",
    futureDate = process.env.DAYOFF_TC011_FUTURE ?? "2026-06-01",
    pastDate = process.env.DAYOFF_TC011_PAST ?? "2026-01-01",
  ) {
    this.username = username;
    this.futureDate = futureDate;
    this.pastDate = pastDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc011Data> {
    if (mode === "static") return new DayoffTc011Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc011Args>("DayoffTc011Data");
      if (cached)
        return new DayoffTc011Data(
          cached.username,
          cached.futureDate,
          cached.pastDate,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithFutureAndPastHolidays(db);
      const instance = new DayoffTc011Data(
        row.login,
        row.future_date,
        row.past_date,
      );
        saveToDisk("DayoffTc011Data", {
          username: row.login,
          futureDate: row.future_date,
          pastDate: row.past_date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  get futureDateDisplay(): string {
    const [y, m, d] = this.futureDate.split("-");
    return `${d}.${m}.${y}`;
  }

  get pastDateDisplay(): string {
    const [y, m, d] = this.pastDate.split("-");
    return `${d}.${m}.${y}`;
  }
}
