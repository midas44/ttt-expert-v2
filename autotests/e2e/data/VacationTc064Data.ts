declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

interface CorrectionTarget {
  accountant_login: string;
  employee_login: string;
  employee_display: string;
  current_days: string;
}

/**
 * TC-VAC-064: Add positive vacation day correction (accountant).
 * Finds an accountant and a target employee with a known balance.
 */
export class VacationTc064Data {
  readonly accountantLogin: string;
  readonly employeeLogin: string;
  readonly employeeDisplay: string;
  readonly currentDays: number;
  readonly correctionAmount: number;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc064Data> {
    if (mode === "static") return new VacationTc064Data();

    const db = new DbClient(tttConfig);
    try {
      // Use chief accountant (broadest visibility on correction page)
      const accRow = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_CHIEF_ACCOUNTANT'
         ORDER BY random()
         LIMIT 1`,
      );

      const emp = await db.queryOne<{ login: string; display: string; days: string }>(
        `SELECT
           e.login,
           COALESCE(be.latin_last_name || ' ' || be.latin_first_name, e.login) AS display,
           ev.available_vacation_days::text AS days
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee_vacation ev ON ev.employee = e.id
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
         LEFT JOIN ttt_backend.employee be ON be.login = e.login
         WHERE e.enabled = true
           AND e.manager IS NOT NULL
         ORDER BY random()
         LIMIT 1`,
      );

      return new VacationTc064Data(
        accRow.login,
        emp.login,
        emp.display,
        Number(emp.days),
        3,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    accountantLogin = process.env.VACATION_TC064_ACCOUNTANT ?? "perekrest",
    employeeLogin = process.env.VACATION_TC064_EMPLOYEE ?? "dmoskvina",
    employeeDisplay = "Moskvina Daria",
    currentDays = 28,
    correctionAmount = 3,
  ) {
    this.accountantLogin = accountantLogin;
    this.employeeLogin = employeeLogin;
    this.employeeDisplay = employeeDisplay;
    this.currentDays = currentDays;
    this.correctionAmount = correctionAmount;
  }
}
