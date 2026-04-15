declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeWithMultiYearBalance } from "./queries/vacationQueries";

interface Tc011Args {
  username: string;
  entries: { year: number; days: number }[];
}

/**
 * TC-VAC-011: Available days counter — per-year breakdown tooltip.
 * Finds an employee with vacation balance across 2+ years.
 */
export class VacationTc011Data {
  readonly username: string;
  /** Expected per-year breakdown from DB. */
  readonly entries: { year: number; days: number }[];
  /** Expected total days (sum of all years). */
  readonly totalDays: number;

  constructor(args: Tc011Args) {
    this.username = args.username;
    this.entries = args.entries;
    this.totalDays = args.entries.reduce((sum, e) => sum + e.days, 0);
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc011Data> {
    if (mode === "static") {
      return new VacationTc011Data({
        username: process.env.VAC_TC011_USER ?? "pvaynmaster",
        entries: [
          { year: 2025, days: 5 },
          { year: 2026, days: 22 },
        ],
      });
    }

    if (mode === "saved") {
      const cached = loadSaved<Tc011Args>("VacationTc011Data");
      if (cached) return new VacationTc011Data(cached);
    }

    const db = new DbClient(tttConfig);
    let result: { login: string; entries: { year: number; days: number }[] };
    try {
      result = await findEmployeeWithMultiYearBalance(db);
    } finally {
      await db.close();
    }

    const args: Tc011Args = {
      username: result.login,
      entries: result.entries,
    };

    saveToDisk("VacationTc011Data", args);
    return new VacationTc011Data(args);
  }
}
