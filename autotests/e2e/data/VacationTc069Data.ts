declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-069: Verify availability chart — Days view.
 * Needs a user who can see other employees on the chart (manager or admin).
 */
export class VacationTc069Data {
  readonly employeeLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc069Data> {
    if (mode === "static") return new VacationTc069Data();

    const db = new DbClient(tttConfig);
    try {
      // Pick a department manager who can see subordinates on the chart
      const row = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc069Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    employeeLogin = process.env.VACATION_TC069_EMPLOYEE ?? "pvaynmaster",
  ) {
    this.employeeLogin = employeeLogin;
  }
}
