declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-020: Verify vacation events feed.
 * Needs an employee with diverse vacation history (multiple statuses).
 */
export class VacationTc020Data {
  readonly employeeLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc020Data> {
    if (mode === "static") return new VacationTc020Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.vacation v ON v.employee = e.id
         WHERE e.enabled = true
         GROUP BY e.login
         HAVING COUNT(DISTINCT v.status) >= 3
            AND COUNT(v.id) >= 10
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc020Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    employeeLogin = process.env.VACATION_TC020_EMPLOYEE ?? "omanoshkina",
  ) {
    this.employeeLogin = employeeLogin;
  }
}
