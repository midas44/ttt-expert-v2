import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface DuplicateEntry {
  login: string;
  year: number;
  count: number;
}

/**
 * TC-VAC-075: Regression — Double accrual on salary office change (#2789).
 * Queries the DB for employees with duplicate employee_vacation entries
 * for the same year, which indicates the double-accrual bug is active.
 */
export class VacationTc075Data {
  readonly duplicates: DuplicateEntry[];

  constructor(duplicates: DuplicateEntry[]) {
    this.duplicates = duplicates;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc075Data> {
    if (mode === "saved") {
      const cached = loadSaved<{ duplicates: DuplicateEntry[] }>("VacationTc075Data");
      if (cached) return new VacationTc075Data(cached.duplicates);
    }
    const db = new DbClient(tttConfig);
    try {
      const rows = await db.query<{
        login: string;
        year: string;
        cnt: string;
      }>(
        `SELECT e.login, ev.year::text, COUNT(*)::text AS cnt
         FROM ttt_vacation.employee_vacation ev
         JOIN ttt_vacation.employee e ON e.id = ev.employee
         WHERE e.enabled = true
         GROUP BY e.login, ev.year
         HAVING COUNT(*) > 1
         ORDER BY COUNT(*) DESC
         LIMIT 20`,
      );

      const duplicates = rows.map((r) => ({
        login: r.login,
        year: parseInt(r.year, 10),
        count: parseInt(r.cnt, 10),
      }));

      saveToDisk("VacationTc075Data", { duplicates });
      return new VacationTc075Data(duplicates);
    } finally {
      await db.close();
    }
  }
}
