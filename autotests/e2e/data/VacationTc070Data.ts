declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-070: Verify availability chart — Months view.
 * Needs any logged-in user; a department manager sees more employees on the chart.
 */
export class VacationTc070Data {
  readonly employeeLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc070Data> {
    if (mode === "static") return new VacationTc070Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc070Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    employeeLogin = process.env.VACATION_TC070_EMPLOYEE ?? "pvaynmaster",
  ) {
    this.employeeLogin = employeeLogin;
  }
}
