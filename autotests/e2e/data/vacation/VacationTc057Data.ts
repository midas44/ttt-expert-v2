declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc057Args {
  username: string;
  totalAvailableDays: number;
  currentYear: number;
}

/**
 * TC-VAC-057: AV=true — full year balance available from Jan 1.
 * Finds an AV=true employee and their total vacation balance.
 * Test verifies UI displays value matching DB, and yearly breakdown shows current year entry.
 */
export class VacationTc057Data {
  readonly username: string;
  readonly totalAvailableDays: number;
  readonly currentYear: number;

  constructor(
    username = process.env.VAC_TC057_USER ?? "pvaynmaster",
    totalAvailableDays = 24,
    currentYear = new Date().getFullYear(),
  ) {
    this.username = username;
    this.totalAvailableDays = totalAvailableDays;
    this.currentYear = currentYear;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc057Data> {
    if (mode === "static") return new VacationTc057Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc057Args>("VacationTc057Data");
      if (cached) {
        return new VacationTc057Data(
          cached.username,
          cached.totalAvailableDays,
          cached.currentYear,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{
        login: string;
        total_available: string;
      }>(
        `SELECT ve.login,
                COALESCE(SUM(ev.available_vacation_days), 0)::text AS total_available
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.office o ON ve.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON ve.id = ev.employee
         WHERE o.advance_vacation = true
           AND ve.enabled = true
           AND ve.manager IS NOT NULL
         GROUP BY ve.login
         HAVING SUM(ev.available_vacation_days) > 5
         ORDER BY random()
         LIMIT 1`,
      );

      const currentYear = new Date().getFullYear();
      const totalAvailable = Math.round(parseFloat(row.total_available));
      const args: Tc057Args = {
        username: row.login,
        totalAvailableDays: totalAvailable,
        currentYear,
      };

      if (mode === "saved") saveToDisk("VacationTc057Data", args);
      return new VacationTc057Data(
        args.username,
        args.totalAvailableDays,
        args.currentYear,
      );
    } finally {
      await db.close();
    }
  }
}
