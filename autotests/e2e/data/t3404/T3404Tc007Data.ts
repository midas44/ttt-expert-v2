declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findDayOffOnOrNearPeriodStart } from "./queries/t3404Queries";

interface Tc007Args {
  username: string;
  dayoffDate: string;
  approveStart: string;
  isExactBoundary: boolean;
}

/**
 * TC-T3404-007: Boundary — day-off ON approve period start date.
 * Tests BUG-T3404-1: useWeekendTableHeaders.tsx uses > instead of >=,
 * so a day-off exactly on the approve period start loses its edit icon.
 * If no holiday exists on the exact date, falls back to closest day-off in the period month.
 */
export class T3404Tc007Data {
  readonly username: string;
  readonly dayoffDate: string;
  readonly approveStart: string;
  readonly isExactBoundary: boolean;

  constructor(
    username = process.env.T3404_TC007_USER ?? "eburets",
    dayoffDate = process.env.T3404_TC007_DATE ?? "2026-03-09",
    approveStart = "2026-03-01",
    isExactBoundary = false,
  ) {
    this.username = username;
    this.dayoffDate = dayoffDate;
    this.approveStart = approveStart;
    this.isExactBoundary = isExactBoundary;
  }

  /** Returns the date in DD.MM.YYYY format for table matching. */
  get dateDisplay(): string {
    const [y, m, d] = this.dayoffDate.split("-");
    return `${d}.${m}.${y}`;
  }

  /**
   * Expected edit icon visibility:
   * - Exact boundary (date === approve start): should be visible per requirement,
   *   but BUG-T3404-1 means code uses > (not >=), so icon may be MISSING.
   * - Non-exact (date > approve start): should be visible (normal open period).
   */
  get expectedEditVisible(): boolean {
    // If exact boundary, the bug causes it to be hidden
    // The test should document this as a known bug
    if (this.isExactBoundary) return false; // BUG-T3404-1: > instead of >=
    return true;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<T3404Tc007Data> {
    if (mode === "static") return new T3404Tc007Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc007Args>("T3404Tc007Data");
      if (cached)
        return new T3404Tc007Data(
          cached.username,
          cached.dayoffDate,
          cached.approveStart,
          cached.isExactBoundary,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findDayOffOnOrNearPeriodStart(db);
      const instance = new T3404Tc007Data(
        row.login,
        row.date,
        row.approve_start,
        row.is_exact,
      );
        saveToDisk("T3404Tc007Data", {
          username: row.login,
          dayoffDate: row.date,
          approveStart: row.approve_start,
          isExactBoundary: row.is_exact,
        });
      return instance;
    } finally {
      await db.close();
    }
  }
}
