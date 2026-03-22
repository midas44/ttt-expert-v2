declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-073: Verify vacation bars on chart match vacation records.
 * Finds an employee with an APPROVED vacation in the current or next month,
 * plus a user who can see that employee on the chart.
 */
export class VacationTc073Data {
  readonly viewerLogin: string;
  readonly employeeFirstName: string;
  readonly employeeLastName: string;
  readonly vacationStart: string;
  readonly vacationEnd: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc073Data> {
    if (mode === "static") return new VacationTc073Data();

    const db = new DbClient(tttConfig);
    try {
      // Find an APPROVED vacation in current or next month
      const vac = await db.queryOne<{
        first_name: string;
        last_name: string;
        start_date: string;
        end_date: string;
      }>(
        `SELECT
           be.latin_first_name AS first_name,
           be.latin_last_name AS last_name,
           v.start_date::text AS start_date,
           v.end_date::text AS end_date
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         JOIN ttt_backend.employee be ON be.login = e.login
         WHERE v.status = 'APPROVED'
           AND v.start_date >= date_trunc('month', CURRENT_DATE)
           AND v.start_date < date_trunc('month', CURRENT_DATE) + interval '2 months'
           AND e.enabled = true
           AND be.latin_first_name IS NOT NULL
         ORDER BY random()
         LIMIT 1`,
      );

      // Get a department manager who can view the chart
      const viewer = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
         ORDER BY random()
         LIMIT 1`,
      );

      return new VacationTc073Data(
        viewer.login,
        vac.first_name,
        vac.last_name,
        vac.start_date,
        vac.end_date,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    viewerLogin = process.env.VACATION_TC073_VIEWER ?? "pvaynmaster",
    employeeFirstName = "Aleksandr",
    employeeLastName = "Budin",
    vacationStart = "2026-03-23",
    vacationEnd = "2026-04-03",
  ) {
    this.viewerLogin = viewerLogin;
    this.employeeFirstName = employeeFirstName;
    this.employeeLastName = employeeLastName;
    this.vacationStart = vacationStart;
    this.vacationEnd = vacationEnd;
  }
}
