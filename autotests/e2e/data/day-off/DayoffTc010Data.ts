declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findEmployeeWithDayOffRequest,
  findFreeHolidayForTransfer,
  findFutureWorkingDay,
} from "./queries/dayoffQueries";

interface Tc010Args {
  username: string;
  originalDate: string;
  personalDate: string;
  requestId: number | null;
  needsApiSetup: boolean;
}

/**
 * TC-DO-010: APPROVED status displays only lastApprovedDate (no arrow).
 *
 * Finds an employee with an existing APPROVED transfer request.
 * If none exists, provides data to create + approve one via API.
 */
export class DayoffTc010Data {
  readonly username: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number | null;
  readonly needsApiSetup: boolean;

  constructor(
    username = process.env.DAYOFF_TC010_USER ?? "trikhter",
    originalDate = process.env.DAYOFF_TC010_ORIG ?? "2026-06-01",
    personalDate = process.env.DAYOFF_TC010_PERS ?? "2026-06-15",
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
  ): Promise<DayoffTc010Data> {
    if (mode === "static") return new DayoffTc010Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc010Args>("DayoffTc010Data");
      if (cached)
        return new DayoffTc010Data(
          cached.username,
          cached.originalDate,
          cached.personalDate,
          cached.requestId,
          cached.needsApiSetup,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const existing = await findEmployeeWithDayOffRequest(
        db,
        "APPROVED",
      ).catch(() => null);

      if (existing) {
        const instance = new DayoffTc010Data(
          existing.login,
          existing.original_date,
          existing.personal_date,
          existing.request_id,
          false,
        );
          saveToDisk("DayoffTc010Data", {
            username: existing.login,
            originalDate: existing.original_date,
            personalDate: existing.personal_date,
            requestId: existing.request_id,
            needsApiSetup: false,
          });
        return instance;
      }

      // No APPROVED request found — find data for API creation + approval
      const row = await findFreeHolidayForTransfer(db);
      const target = await findFutureWorkingDay(db, row.login, row.public_date);
      const instance = new DayoffTc010Data(
        row.login,
        row.public_date,
        target,
        null,
        true,
      );
        saveToDisk("DayoffTc010Data", {
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
}
