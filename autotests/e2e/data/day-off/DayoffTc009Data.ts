declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithDayOffRequest,
  findFreeHolidayForTransfer,
  findFutureWorkingDay,
} from "./queries/dayoffQueries";

interface Tc009Args {
  username: string;
  originalDate: string;
  personalDate: string;
  requestId: number | null;
  needsApiSetup: boolean;
}

/**
 * TC-DO-009: NEW status displays arrow format (originalDate → personalDate).
 *
 * Finds an employee with an existing NEW transfer request to verify
 * the arrow display format. If none exists, provides data to create one.
 */
export class DayoffTc009Data {
  readonly username: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number | null;
  readonly needsApiSetup: boolean;

  constructor(
    username = process.env.DAYOFF_TC009_USER ?? "trikhter",
    originalDate = process.env.DAYOFF_TC009_ORIG ?? "2026-06-01",
    personalDate = process.env.DAYOFF_TC009_PERS ?? "2026-06-15",
    requestId: number | null = null,
    needsApiSetup = true,
  ) {
    this.username = username;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
    this.requestId = requestId;
    this.needsApiSetup = needsApiSetup;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc009Data> {
    if (mode === "static") return new DayoffTc009Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc009Args>("DayoffTc009Data");
      if (cached)
        return new DayoffTc009Data(
          cached.username,
          cached.originalDate,
          cached.personalDate,
          cached.requestId,
          cached.needsApiSetup,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const existing = await findEmployeeWithDayOffRequest(db, "NEW").catch(
        () => null,
      );

      if (existing) {
        const instance = new DayoffTc009Data(
          existing.login,
          existing.original_date,
          existing.personal_date,
          existing.request_id,
          false,
        );
          saveToDisk("DayoffTc009Data", {
            username: existing.login,
            originalDate: existing.original_date,
            personalDate: existing.personal_date,
            requestId: existing.request_id,
            needsApiSetup: false,
          });
        return instance;
      }

      const row = await findFreeHolidayForTransfer(db);
      const target = await findFutureWorkingDay(db, row.login, row.public_date);
      const instance = new DayoffTc009Data(
        row.login,
        row.public_date,
        target,
        null,
        true,
      );
        saveToDisk("DayoffTc009Data", {
          username: row.login,
          originalDate: row.public_date,
          personalDate: target,
          requestId: null,
          needsApiSetup: true,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  get originalDateDisplay(): string {
    const [y, m, d] = this.originalDate.split("-");
    return `${d}.${m}.${y}`;
  }

  get personalDateDisplay(): string {
    const [y, m, d] = this.personalDate.split("-");
    return `${d}.${m}.${y}`;
  }

  get personalDateParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.personalDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }
}
