import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";

interface MaternityEmployee {
  login: string;
  availableDays: number;
  year: number;
  hasOverlappingVacation: boolean;
}

/**
 * TC-VAC-077: Regression — Maternity leave overlap, days not returned (#3352).
 * Finds employees on maternity leave and checks their vacation balance
 * for inconsistencies. Bug #3352 (OPEN): overlapping maternity + vacation
 * → vacation days not properly returned to balance.
 */
export class VacationTc077Data {
  readonly maternityEmployees: MaternityEmployee[];

  constructor(employees: MaternityEmployee[]) {
    this.maternityEmployees = employees;
  }

  static async create(
    _mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc077Data> {
    const db = new DbClient(tttConfig);
    try {
      const rows = await db.query<{
        login: string;
        available_days: string;
        year: string;
        has_overlap: string;
      }>(
        `SELECT e.login,
                COALESCE(ev.available_vacation_days, 0)::text AS available_days,
                COALESCE(ev.year, EXTRACT(YEAR FROM CURRENT_DATE))::text AS year,
                CASE WHEN EXISTS (
                  SELECT 1 FROM ttt_vacation.vacation v
                  WHERE v.employee = e.id
                    AND v.status NOT IN ('DELETED', 'CANCELED', 'REJECTED')
                ) THEN '1' ELSE '0' END AS has_overlap
         FROM ttt_vacation.employee e
         LEFT JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
         WHERE e.maternity = true
           AND e.enabled = true
         ORDER BY e.login
         LIMIT 20`,
      );

      const employees = rows.map((r) => ({
        login: r.login,
        availableDays: parseFloat(r.available_days),
        year: parseInt(r.year, 10),
        hasOverlappingVacation: r.has_overlap === "1",
      }));

      return new VacationTc077Data(employees);
    } finally {
      await db.close();
    }
  }
}
