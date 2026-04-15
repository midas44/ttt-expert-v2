declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeWithWorkingWeekend } from "./queries/dayoffQueries";

interface Tc016Args {
  username: string;
  holidayDate: string;
  workingWeekendDate: string;
  workingWeekendDow: number;
}

/**
 * TC-DO-016: Working weekend dates selectable in transfer calendar.
 *
 * Needs an employee whose office calendar has a working weekend (Sat/Sun
 * with duration > 0). The test opens the reschedule dialog and verifies
 * that working weekends are selectable while regular weekends are disabled.
 */
export class DayoffTc016Data {
  readonly username: string;
  readonly holidayDate: string;
  readonly workingWeekendDate: string;
  /** Day of week: 0=Sunday, 6=Saturday */
  readonly workingWeekendDow: number;

  constructor(
    username = process.env.DAYOFF_TC016_USER ?? "pbelova",
    holidayDate = process.env.DAYOFF_TC016_HOLIDAY ?? "2026-05-01",
    workingWeekendDate = process.env.DAYOFF_TC016_WWDATE ?? "2026-05-10",
    workingWeekendDow = 6,
  ) {
    this.username = username;
    this.holidayDate = holidayDate;
    this.workingWeekendDate = workingWeekendDate;
    this.workingWeekendDow = workingWeekendDow;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc016Data> {
    if (mode === "static") return new DayoffTc016Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc016Args>("DayoffTc016Data");
      if (cached)
        return new DayoffTc016Data(
          cached.username,
          cached.holidayDate,
          cached.workingWeekendDate,
          cached.workingWeekendDow,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithWorkingWeekend(db);
      const instance = new DayoffTc016Data(
        row.login,
        row.holidayDate,
        row.workingWeekendDate,
        row.workingWeekendDow,
      );
        saveToDisk("DayoffTc016Data", {
          username: row.login,
          holidayDate: row.holidayDate,
          workingWeekendDate: row.workingWeekendDate,
          workingWeekendDow: row.workingWeekendDow,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Holiday date in DD.MM.YYYY for matching the table row. */
  get holidayDateDisplay(): string {
    const [y, m, d] = this.holidayDate.split("-");
    return `${d}.${m}.${y}`;
  }

  /** Working weekend parsed into calendar-compatible parts (month 0-indexed). */
  get workingWeekendParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.workingWeekendDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }

  /**
   * Finds a regular weekend day in the same month as the working weekend
   * that should be DISABLED (not a working weekend). Picks a Sat/Sun at
   * least 7 days away from the working weekend to avoid the same week pair.
   */
  get regularWeekendDay(): number {
    const { day: wwDay, month, year } = this.workingWeekendParts;
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      const dow = d.getDay();
      const dayNum = d.getDate();
      if ((dow === 0 || dow === 6) && Math.abs(dayNum - wwDay) > 2) {
        return dayNum;
      }
      d.setDate(d.getDate() + 1);
    }
    return 0;
  }
}
