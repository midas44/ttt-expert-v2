declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findEmployeeWithTwoFreeHolidays,
  createTransferForEmployee,
  deleteTransferRequest,
} from "./queries/dayoffQueries";

interface Tc050Args {
  username: string;
  holiday2: string;
  personalDate: string;
  requestId: number;
}

/**
 * TC-DO-050: Transfer to already-used personalDate blocked in UI.
 *
 * Same pattern as TC-DO-015 — creates a transfer to occupy a personalDate,
 * then opens a different holiday's reschedule dialog and verifies the
 * occupied personalDate is disabled (greyed out) in the calendar picker.
 * Validates the @EmployeeDayOffPersonalDateExists UI-level enforcement.
 */
export class DayoffTc050Data {
  readonly username: string;
  readonly holiday2: string;
  readonly personalDate: string;
  readonly requestId: number;

  constructor(
    username = process.env.DAYOFF_TC050_USER ?? "pbelova",
    holiday2 = process.env.DAYOFF_TC050_HOLIDAY2 ?? "2026-05-09",
    personalDate = process.env.DAYOFF_TC050_PERSONAL ?? "2026-05-15",
    requestId = 0,
  ) {
    this.username = username;
    this.holiday2 = holiday2;
    this.personalDate = personalDate;
    this.requestId = requestId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc050Data> {
    if (mode === "static") return new DayoffTc050Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc050Args>("DayoffTc050Data");
      if (cached)
        return new DayoffTc050Data(
          cached.username,
          cached.holiday2,
          cached.personalDate,
          cached.requestId,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithTwoFreeHolidays(db);
      const transfer = await createTransferForEmployee(
        db,
        row.login,
        row.holiday1,
      );
      const instance = new DayoffTc050Data(
        row.login,
        row.holiday2,
        transfer.personalDate,
        transfer.requestId,
      );
        saveToDisk("DayoffTc050Data", {
          username: row.login,
          holiday2: row.holiday2,
          personalDate: transfer.personalDate,
          requestId: transfer.requestId,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  static async cleanup(
    requestId: number,
    tttConfig: TttConfig,
  ): Promise<void> {
    if (!requestId) return;
    const db = new DbClient(tttConfig);
    try {
      await deleteTransferRequest(db, requestId);
    } finally {
      await db.close();
    }
  }

  get holiday2Display(): string {
    const [y, m, d] = this.holiday2.split("-");
    return `${d}.${m}.${y}`;
  }

  get personalDateParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.personalDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }
}
