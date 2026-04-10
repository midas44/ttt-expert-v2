declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithTwoFreeHolidays,
  createTransferForEmployee,
  deleteTransferRequest,
} from "./queries/dayoffQueries";

interface Tc015Args {
  username: string;
  holiday2: string;
  personalDate: string;
  requestId: number;
}

/**
 * TC-DO-015: Transfer calendar disables existing day-off dates.
 *
 * Needs an employee with 2 future free holidays. Creates a transfer for holiday1
 * to occupy a personalDate, then the test opens the dialog for holiday2 and
 * verifies the personalDate is disabled in the calendar picker.
 */
export class DayoffTc015Data {
  readonly username: string;
  /** The holiday to open the reschedule dialog for. */
  readonly holiday2: string;
  /** The personalDate occupied by the setup transfer — should be disabled. */
  readonly personalDate: string;
  /** ID of the setup transfer request (for cleanup). */
  readonly requestId: number;

  constructor(
    username = process.env.DAYOFF_TC015_USER ?? "pbelova",
    holiday2 = process.env.DAYOFF_TC015_HOLIDAY2 ?? "2026-05-09",
    personalDate = process.env.DAYOFF_TC015_PERSONAL ?? "2026-05-15",
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
  ): Promise<DayoffTc015Data> {
    if (mode === "static") return new DayoffTc015Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc015Args>("DayoffTc015Data");
      if (cached)
        return new DayoffTc015Data(
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
      const instance = new DayoffTc015Data(
        row.login,
        row.holiday2,
        transfer.personalDate,
        transfer.requestId,
      );
        saveToDisk("DayoffTc015Data", {
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

  /** Holiday2 in DD.MM.YYYY for matching the table row. */
  get holiday2Display(): string {
    const [y, m, d] = this.holiday2.split("-");
    return `${d}.${m}.${y}`;
  }

  /** PersonalDate parsed into calendar-compatible parts (month is 0-indexed). */
  get personalDateParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.personalDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }
}
