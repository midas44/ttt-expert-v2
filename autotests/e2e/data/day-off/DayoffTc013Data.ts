declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithDayOffRequest } from "./queries/dayoffQueries";

interface Tc013Args {
  username: string;
  originalDate: string;
  personalDate: string;
}

/**
 * TC-DO-013: Transfer modal date constraints — min boundary.
 *
 * Uses an employee with an existing NEW transfer request.
 * The test opens the reschedule modal on the request row (edit mode) and verifies
 * that dates before the original date are disabled in the calendar picker.
 */
export class DayoffTc013Data {
  readonly username: string;
  /** Original holiday date (ISO). */
  readonly originalDate: string;
  /** Current personal date (ISO) — the request's transfer target. */
  readonly personalDate: string;

  constructor(
    username = process.env.DAYOFF_TC013_USER ?? "oberezka",
    originalDate = process.env.DAYOFF_TC013_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC013_PERS ?? "2026-07-07",
  ) {
    this.username = username;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc013Data> {
    if (mode === "static") return new DayoffTc013Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc013Args>("DayoffTc013Data");
      if (cached)
        return new DayoffTc013Data(
          cached.username,
          cached.originalDate,
          cached.personalDate,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithDayOffRequest(db, "NEW");
      const instance = new DayoffTc013Data(
        row.login,
        row.original_date,
        row.personal_date,
      );

      if (mode === "saved")
        saveToDisk("DayoffTc013Data", {
          username: row.login,
          originalDate: row.original_date,
          personalDate: row.personal_date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Display format DD.MM.YYYY for original date — used to match table row (arrow format). */
  get originalDateDisplay(): string {
    const [y, m, d] = this.originalDate.split("-");
    return `${d}.${m}.${y}`;
  }

  /** Parse originalDate into parts for calendar navigation. */
  get originalDateParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.originalDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }
}
