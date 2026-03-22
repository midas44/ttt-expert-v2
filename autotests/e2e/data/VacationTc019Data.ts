declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-019: Verify pagination on vacation table.
 * Needs an employee with >10 vacation records to ensure multiple pages.
 */
export class VacationTc019Data {
  readonly employeeLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc019Data> {
    if (mode === "static") return new VacationTc019Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.vacation v ON v.employee = e.id
         WHERE e.enabled = true
         GROUP BY e.login
         HAVING COUNT(v.id) > 20
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc019Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    employeeLogin = process.env.VACATION_TC019_EMPLOYEE ?? "kuzmin",
  ) {
    this.employeeLogin = employeeLogin;
  }
}
