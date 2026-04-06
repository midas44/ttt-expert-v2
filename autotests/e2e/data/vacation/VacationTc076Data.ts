declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface Tc076Args {
  /** Employees with last_date in ttt_backend but NULL in ttt_vacation */
  mismatched: MismatchedEmployee[];
}

interface MismatchedEmployee {
  login: string;
  backendLastDate: string | null;
  vacationLastDate: string | null;
}

/**
 * TC-VAC-076: Regression — last_date not updated during CS sync (#3374).
 * Pure API test. Triggers CS sync and verifies last_date consistency
 * between ttt_backend.employee and ttt_vacation.employee schemas.
 *
 * Bug #3374 (OPEN): The CS sync does not propagate last_date to ttt_vacation.employee,
 * causing employees to be able to create vacations beyond their termination date.
 */
export class VacationTc076Data {
  readonly mismatched: MismatchedEmployee[];

  constructor(args: Tc076Args) {
    this.mismatched = args.mismatched;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc076Data> {
    const defaults: Tc076Args = {
      mismatched: [
        {
          login: "abpopov",
          backendLastDate: "2026-03-31",
          vacationLastDate: null,
        },
      ],
    };
    if (mode === "static") return new VacationTc076Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc076Args>("VacationTc076Data");
      if (cached) return new VacationTc076Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Find employees with mismatched last_date between schemas
      const rows = await db.query<{
        login: string;
        backend_last_date: string | null;
        vacation_last_date: string | null;
      }>(
        `SELECT be.login,
                be.last_date::text AS backend_last_date,
                ve.last_date::text AS vacation_last_date
         FROM ttt_backend.employee be
         JOIN ttt_vacation.employee ve ON be.login = ve.login
         WHERE (be.last_date IS DISTINCT FROM ve.last_date)
           AND be.enabled = true
         ORDER BY be.last_date DESC NULLS LAST
         LIMIT 10`,
      );

      const mismatched: MismatchedEmployee[] = rows.map((r) => ({
        login: r.login,
        backendLastDate: r.backend_last_date,
        vacationLastDate: r.vacation_last_date,
      }));

      const args: Tc076Args = { mismatched };
      saveToDisk("VacationTc076Data", args);
      return new VacationTc076Data(args);
    } finally {
      await db.close();
    }
  }
}
