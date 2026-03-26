declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findPastDayoffInOpenPeriod } from "./queries/t3404Queries";

interface Tc001Args {
  username: string;
  editableDate: string;
}

/**
 * TC-T3404-001: EN tooltip text — "Reschedule event" (no "an").
 * Needs an employee with an editable day-off (edit icon visible) in EN language.
 */
export class T3404Tc001Data {
  readonly username: string;
  readonly editableDate: string;

  constructor(
    username = process.env.T3404_TC001_USER ?? "eburets",
    editableDate = "2026-03-08",
  ) {
    this.username = username;
    this.editableDate = editableDate;
  }

  get dateDisplay(): string {
    const [y, m, d] = this.editableDate.split("-");
    return `${d}.${m}.${y}`;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc001Data> {
    if (mode === "static") return new T3404Tc001Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc001Args>("T3404Tc001Data");
      if (cached)
        return new T3404Tc001Data(cached.username, cached.editableDate);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPastDayoffInOpenPeriod(db);
      const instance = new T3404Tc001Data(row.login, row.date);
      if (mode === "saved")
        saveToDisk("T3404Tc001Data", {
          username: row.login,
          editableDate: row.date,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
