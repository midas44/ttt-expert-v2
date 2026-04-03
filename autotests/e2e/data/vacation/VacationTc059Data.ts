declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc059Args {
  username: string;
  totalAvailableDays: number;
  currentYear: number;
  annualNorm: number;
}

/**
 * TC-VAC-059: AV=false — monthly accrual, no negative.
 * Finds an AV=false employee with positive balance.
 * Test verifies UI balance is proportional to months elapsed and never negative.
 */
export class VacationTc059Data {
  readonly username: string;
  readonly totalAvailableDays: number;
  readonly currentYear: number;
  readonly annualNorm: number;

  constructor(
    username = process.env.VAC_TC059_USER ?? "pvaynmaster",
    totalAvailableDays = 8,
    currentYear = new Date().getFullYear(),
    annualNorm = 24,
  ) {
    this.username = username;
    this.totalAvailableDays = totalAvailableDays;
    this.currentYear = currentYear;
    this.annualNorm = annualNorm;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc059Data> {
    if (mode === "static") return new VacationTc059Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc059Args>("VacationTc059Data");
      if (cached) {
        return new VacationTc059Data(
          cached.username,
          cached.totalAvailableDays,
          cached.currentYear,
          cached.annualNorm,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{
        login: string;
        total_available: string;
        annual_norm: string;
      }>(
        `SELECT ve.login,
                COALESCE(SUM(ev.available_vacation_days), 0)::text AS total_available,
                COALESCE(
                  (SELECT oal.days
                   FROM ttt_vacation.office_annual_leave oal
                   WHERE oal.office = o.id
                   ORDER BY oal.since_year DESC
                   LIMIT 1),
                  24
                )::text AS annual_norm
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.office o ON ve.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON ve.id = ev.employee
         WHERE o.advance_vacation = false
           AND ve.enabled = true
           AND ve.manager IS NOT NULL
         GROUP BY ve.login, o.id
         HAVING SUM(ev.available_vacation_days) > 0
         ORDER BY random()
         LIMIT 1`,
      );

      const currentYear = new Date().getFullYear();
      const totalAvailable = Math.round(parseFloat(row.total_available));
      const annualNorm = parseInt(row.annual_norm, 10);
      const args: Tc059Args = {
        username: row.login,
        totalAvailableDays: totalAvailable,
        currentYear,
        annualNorm,
      };

      if (mode === "saved") saveToDisk("VacationTc059Data", args);
      return new VacationTc059Data(
        args.username,
        args.totalAvailableDays,
        args.currentYear,
        args.annualNorm,
      );
    } finally {
      await db.close();
    }
  }
}
