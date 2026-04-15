declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findFreeHolidayFromDayoffTable,
  createTransferForEmployee,
  deleteTransferRequest,
  countEmployeeDayoffs,
} from "./queries/dayoffQueries";

interface Tc042Args {
  username: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
  expectedRowCount: number;
}

/**
 * TC-DO-042: MY search type — own requests only.
 *
 * Creates a transfer request for the employee, then verifies the Days off
 * tab shows only the logged-in employee's own day-off records including
 * the newly created transfer (arrow format).
 */
export class DayoffTc042Data {
  readonly username: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number;
  readonly expectedRowCount: number;

  constructor(
    username = process.env.DAYOFF_TC042_USER ?? "pbelova",
    originalDate = process.env.DAYOFF_TC042_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC042_PERS ?? "2026-05-15",
    requestId = 0,
    expectedRowCount = 14,
  ) {
    this.username = username;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
    this.requestId = requestId;
    this.expectedRowCount = expectedRowCount;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc042Data> {
    if (mode === "static") return new DayoffTc042Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc042Args>("DayoffTc042Data");
      if (cached)
        return new DayoffTc042Data(
          cached.username,
          cached.originalDate,
          cached.personalDate,
          cached.requestId,
          cached.expectedRowCount,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findFreeHolidayFromDayoffTable(db);
      const transfer = await createTransferForEmployee(
        db,
        row.login,
        row.public_date,
      );
      const currentYear = new Date().getFullYear();
      const rowCount = await countEmployeeDayoffs(db, row.login, currentYear);

      const instance = new DayoffTc042Data(
        row.login,
        row.public_date,
        transfer.personalDate,
        transfer.requestId,
        rowCount,
      );
        saveToDisk("DayoffTc042Data", {
          username: row.login,
          originalDate: row.public_date,
          personalDate: transfer.personalDate,
          requestId: transfer.requestId,
          expectedRowCount: rowCount,
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

  /** Original date in DD.MM.YYYY for matching the arrow-format row. */
  get originalDateDisplay(): string {
    const [y, m, d] = this.originalDate.split("-");
    return `${d}.${m}.${y}`;
  }

  /** Personal date in DD.MM.YYYY for verifying arrow format. */
  get personalDateDisplay(): string {
    const [y, m, d] = this.personalDate.split("-");
    return `${d}.${m}.${y}`;
  }
}
