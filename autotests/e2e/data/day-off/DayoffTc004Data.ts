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

interface Tc004Args {
  username: string;
  originalDate: string;
  currentPersonalDate: string;
  newTargetDate: string;
  requestId: number | null;
  needsApiSetup: boolean;
}

/**
 * TC-DO-004: Edit transfer request (change personal date).
 *
 * Finds an employee with an existing NEW transfer request, plus a different
 * future working day to use as the new target date. If no NEW request exists,
 * provides data to create one first.
 */
export class DayoffTc004Data {
  readonly username: string;
  readonly originalDate: string;
  readonly currentPersonalDate: string;
  readonly newTargetDate: string;
  readonly requestId: number | null;
  readonly needsApiSetup: boolean;

  constructor(
    username = process.env.DAYOFF_TC004_USER ?? "trikhter",
    originalDate = process.env.DAYOFF_TC004_ORIG ?? "2026-06-01",
    currentPersonalDate = process.env.DAYOFF_TC004_PERS ?? "2026-06-15",
    newTargetDate = process.env.DAYOFF_TC004_TARGET ?? "2026-06-22",
    requestId: number | null = null,
    needsApiSetup = true,
  ) {
    this.username = username;
    this.originalDate = originalDate;
    this.currentPersonalDate = currentPersonalDate;
    this.newTargetDate = newTargetDate;
    this.requestId = requestId;
    this.needsApiSetup = needsApiSetup;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc004Data> {
    if (mode === "static") return new DayoffTc004Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc004Args>("DayoffTc004Data");
      if (cached)
        return new DayoffTc004Data(
          cached.username,
          cached.originalDate,
          cached.currentPersonalDate,
          cached.newTargetDate,
          cached.requestId,
          cached.needsApiSetup,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      // Try to find an existing NEW transfer request
      const existing = await findEmployeeWithDayOffRequest(db, "NEW").catch(
        () => null,
      );

      if (existing) {
        const newTarget = await findFutureWorkingDay(
          db,
          existing.login,
          existing.personal_date,
        );
        const instance = new DayoffTc004Data(
          existing.login,
          existing.original_date,
          existing.personal_date,
          newTarget,
          existing.request_id,
          false,
        );
          saveToDisk("DayoffTc004Data", {
            username: existing.login,
            originalDate: existing.original_date,
            currentPersonalDate: existing.personal_date,
            newTargetDate: newTarget,
            requestId: existing.request_id,
            needsApiSetup: false,
          });
        return instance;
      }

      // No existing NEW request — find a free holiday to create one
      const row = await findFreeHolidayForTransfer(db);
      const firstTarget = await findFutureWorkingDay(
        db,
        row.login,
        row.public_date,
      );
      const secondTarget = await findFutureWorkingDay(
        db,
        row.login,
        firstTarget,
      );

      const instance = new DayoffTc004Data(
        row.login,
        row.public_date,
        firstTarget,
        secondTarget,
        null,
        true,
      );

        saveToDisk("DayoffTc004Data", {
          username: row.login,
          originalDate: row.public_date,
          currentPersonalDate: firstTarget,
          newTargetDate: secondTarget,
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

  get currentPersonalDateParts(): {
    day: number;
    month: number;
    year: number;
  } {
    const [y, m, d] = this.currentPersonalDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }

  get newTargetDateParts(): { day: number; month: number; year: number } {
    const [y, m, d] = this.newTargetDate.split("-").map(Number);
    return { day: d, month: m - 1, year: y };
  }

  get newTargetDateDisplay(): string {
    const [y, m, d] = this.newTargetDate.split("-");
    return `${d}.${m}.${y}`;
  }
}
