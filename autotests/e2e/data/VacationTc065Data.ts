declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-065: Add negative vacation day correction (AV=true only).
 * Finds a chief accountant and an AV=true employee with positive balance (>5).
 */
export class VacationTc065Data {
  readonly accountantLogin: string;
  readonly employeeLogin: string;
  readonly employeeDisplay: string;
  readonly currentDays: number;
  readonly correctionAmount: number; // negative, e.g. -2

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc065Data> {
    if (mode === "static") return new VacationTc065Data();

    const db = new DbClient(tttConfig);
    try {
      const accRow = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_CHIEF_ACCOUNTANT'
         ORDER BY random()
         LIMIT 1`,
      );

      // AV=true employee with balance > 5 so negative correction is safe
      const emp = await db.queryOne<{ login: string; display: string; days: string }>(
        `SELECT
           e.login,
           COALESCE(be.latin_last_name || ' ' || be.latin_first_name, e.login) AS display,
           ev.available_vacation_days::text AS days
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.office o ON e.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON ev.employee = e.id
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
         LEFT JOIN ttt_backend.employee be ON be.login = e.login
         WHERE e.enabled = true
           AND o.advance_vacation = true
           AND ev.available_vacation_days > 5
         ORDER BY random()
         LIMIT 1`,
      );

      return new VacationTc065Data(
        accRow.login,
        emp.login,
        emp.display,
        Number(emp.days),
        -2,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    accountantLogin = process.env.VACATION_TC065_ACCOUNTANT ?? "perekrest",
    employeeLogin = process.env.VACATION_TC065_EMPLOYEE ?? "dmoskvina",
    employeeDisplay = "Moskvina Daria",
    currentDays = 28,
    correctionAmount = -2,
  ) {
    this.accountantLogin = accountantLogin;
    this.employeeLogin = employeeLogin;
    this.employeeDisplay = employeeDisplay;
    this.currentDays = currentDays;
    this.correctionAmount = correctionAmount;
  }
}
