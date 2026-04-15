declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findFreeHolidayForTransfer } from "./queries/dayoffQueries";

interface Tc014Args {
  username: string;
  holidayDate: string;
}

/**
 * TC-DO-014: Transfer modal date constraints — max boundary.
 *
 * Needs an employee with a future holiday that has no active transfer request.
 * The test opens the reschedule dialog and verifies the calendar picker's
 * maximum selectable date is Dec 31 of the holiday's year.
 * Frontend formula: moment(originalDate.format('YYYY')).add(1,'y').subtract(1,'d')
 */
export class DayoffTc014Data {
  readonly username: string;
  /** ISO date of the holiday to click edit on. */
  readonly holidayDate: string;

  constructor(
    username = process.env.DAYOFF_TC014_USER ?? "pbelova",
    holidayDate = process.env.DAYOFF_TC014_DATE ?? "2026-04-01",
  ) {
    this.username = username;
    this.holidayDate = holidayDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc014Data> {
    if (mode === "static") return new DayoffTc014Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc014Args>("DayoffTc014Data");
      if (cached)
        return new DayoffTc014Data(cached.username, cached.holidayDate);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findFreeHolidayForTransfer(db);
      const instance = new DayoffTc014Data(row.login, row.public_date);
        saveToDisk("DayoffTc014Data", {
          username: row.login,
          holidayDate: row.public_date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Holiday date in DD.MM.YYYY display format for matching table rows. */
  get holidayDateDisplay(): string {
    const [y, m, d] = this.holidayDate.split("-");
    return `${d}.${m}.${y}`;
  }

  /** The maximum allowed transfer date: Dec 31 of the holiday year. */
  get maxBoundaryYear(): number {
    return parseInt(this.holidayDate.split("-")[0], 10);
  }

  /** Max boundary month (0-indexed): December = 11 */
  get maxBoundaryMonth(): number {
    return 11;
  }
}
