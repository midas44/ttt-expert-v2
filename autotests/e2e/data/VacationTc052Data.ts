declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface PaidVacationRow {
  employee_login: string;
  employee_name: string;
  manager_login: string;
  start_date: string;
  end_date: string;
}

/**
 * TC-VAC-052: Verify PAID status is terminal — no actions available.
 * Finds an employee with a PAID vacation, their manager, and an accountant.
 */
export class VacationTc052Data {
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly managerLogin: string;
  readonly accountantLogin: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc052Data> {
    if (mode === "static") return new VacationTc052Data();

    const db = new DbClient(tttConfig);
    try {
      // Find employee with a recent PAID vacation and their manager
      // Use most recent PAID vacation so it appears near the top of the Closed tab
      const vacation = await db.queryOne<PaidVacationRow>(
        `SELECT e.login AS employee_login,
                COALESCE(be.latin_last_name || ' ' || be.latin_first_name, e.login) AS employee_name,
                m.login AS manager_login,
                v.start_date::text AS start_date,
                v.end_date::text AS end_date
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         JOIN ttt_vacation.employee m ON e.manager = m.id
         LEFT JOIN ttt_backend.employee be ON be.login = e.login
         WHERE v.status = 'PAID'
           AND e.enabled = true
           AND m.enabled = true
         ORDER BY v.end_date DESC
         LIMIT 1`,
      );

      // Find an accountant
      const accountant = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name IN ('ROLE_ACCOUNTANT', 'ROLE_CHIEF_ACCOUNTANT')
         ORDER BY random()
         LIMIT 1`,
      );

      return new VacationTc052Data(
        vacation.employee_login,
        vacation.employee_name,
        vacation.manager_login,
        accountant.login,
        vacation.start_date,
        vacation.end_date,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    employeeLogin = process.env.VACATION_TC052_EMPLOYEE ?? "amelnikova",
    employeeName = "Melnikova Anna",
    managerLogin = process.env.VACATION_TC052_MANAGER ?? "pvaynmaster",
    accountantLogin = process.env.VACATION_TC052_ACCOUNTANT ?? "perekrest",
    startDate = "2026-01-12",
    endDate = "2026-01-16",
  ) {
    this.employeeLogin = employeeLogin;
    this.employeeName = employeeName;
    this.managerLogin = managerLogin;
    this.accountantLogin = accountantLogin;
    this.startDate = startDate;
    this.endDate = endDate;
    this.periodPattern = this.buildPattern(startDate, endDate);
  }

  private buildPattern(startStr: string, endStr: string): RegExp {
    const start = new Date(startStr + "T00:00:00Z");
    const end = new Date(endStr + "T00:00:00Z");
    const sDay = start.getUTCDate();
    const eDay = end.getUTCDate();
    const sMonth = start.getUTCMonth();
    const eMonth = end.getUTCMonth();
    const eYear = end.getUTCFullYear();
    const sDD = String(sDay).padStart(2, "0");
    const sMM = String(sMonth + 1).padStart(2, "0");
    const eDD = String(eDay).padStart(2, "0");
    const eMM = String(eMonth + 1).padStart(2, "0");

    const alternatives = [
      `0?${sDay}\\s*[–\\-]\\s*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}\\w*\\s+${eYear}`,
      `${sDD}\\.${sMM}.*${eDD}\\.${eMM}`,
      `0?${sDay}\\s+${MONTH_ABBREVS[sMonth]}.*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}`,
    ];
    return new RegExp(alternatives.join("|"));
  }
}
