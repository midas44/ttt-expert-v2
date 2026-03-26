declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findFreeHolidayForTransfer,
  findFutureWorkingDay,
} from "./queries/dayoffQueries";

interface Tc003Args {
  username: string;
  publicDate: string;
  targetDate: string;
}

/**
 * TC-DO-003: Create transfer request (reschedule day-off to future date).
 *
 * Finds an employee with a future public holiday that has NO active transfer
 * request. The test clicks edit on that holiday row, selects a target date
 * via the reschedule modal, and verifies the new transfer request is created.
 */
export class DayoffTc003Data {
  readonly username: string;
  readonly publicDate: string;
  readonly targetDate: string;

  constructor(
    username = process.env.DAYOFF_TC003_USER ?? "trikhter",
    publicDate = process.env.DAYOFF_TC003_DATE ?? "2026-06-01",
    targetDate = process.env.DAYOFF_TC003_TARGET ?? "2026-06-15",
  ) {
    this.username = username;
    this.publicDate = publicDate;
    this.targetDate = targetDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc003Data> {
    if (mode === "static") return new DayoffTc003Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc003Args>("DayoffTc003Data");
      if (cached)
        return new DayoffTc003Data(
          cached.username,
          cached.publicDate,
          cached.targetDate,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findFreeHolidayForTransfer(db);

      const targetDate = await findFutureWorkingDay(
        db,
        row.login,
        row.public_date,
      );

      const instance = new DayoffTc003Data(
        row.login,
        row.public_date,
        targetDate,
      );

      if (mode === "saved")
        saveToDisk("DayoffTc003Data", {
          username: row.login,
          publicDate: row.public_date,
          targetDate,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Parse targetDate to {day, month, year} for calendar picker. */
  get targetDateParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.targetDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }

  /**
   * Converts publicDate from ISO (YYYY-MM-DD) to display format (DD.MM.YYYY).
   * Used to match the date in the table row.
   */
  get publicDateDisplay(): string {
    const [y, m, d] = this.publicDate.split("-");
    return `${d}.${m}.${y}`;
  }
}
