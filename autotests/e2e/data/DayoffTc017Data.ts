declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "./savedDataStore";
import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeWithDayOffRequest } from "./queries/dayoffQueries";

interface Tc017Args {
  username: string;
  originalDate: string;
}

/**
 * TC-DO-017: OK button disabled until date selected in transfer modal.
 *
 * Strategy: find an employee with a NEW transfer request, cancel it via UI
 * to free the holiday, then test the create modal (OK disabled → select date → OK enabled).
 */
export class DayoffTc017Data {
  readonly username: string;
  /** Original holiday date (ISO) — the request to cancel, then test create modal. */
  readonly originalDate: string;

  constructor(
    username = process.env.DAYOFF_TC017_USER ?? "oberezka",
    originalDate = process.env.DAYOFF_TC017_ORIG ?? "2026-05-01",
  ) {
    this.username = username;
    this.originalDate = originalDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc017Data> {
    if (mode === "static") return new DayoffTc017Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc017Args>("DayoffTc017Data");
      if (cached)
        return new DayoffTc017Data(cached.username, cached.originalDate);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithDayOffRequest(db, "NEW");
      const instance = new DayoffTc017Data(row.login, row.original_date);

      if (mode === "saved")
        saveToDisk("DayoffTc017Data", {
          username: row.login,
          originalDate: row.original_date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Display format DD.MM.YYYY for the original date. */
  get originalDateDisplay(): string {
    const [y, m, d] = this.originalDate.split("-");
    return `${d}.${m}.${y}`;
  }
}
