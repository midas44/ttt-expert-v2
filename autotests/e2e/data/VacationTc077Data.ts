declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-077: Regular employee cannot access Payment page.
 * Finds a regular employee without accountant or admin roles.
 */
export class VacationTc077Data {
  readonly username: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc077Data> {
    if (mode === "static") return new VacationTc077Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         JOIN ttt_backend.employee be ON be.login = e.login
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE e.enabled = true
           AND r.role_name = 'ROLE_EMPLOYEE'
           AND NOT EXISTS (
             SELECT 1 FROM ttt_backend.employee_global_roles r2
             WHERE r2.employee = be.id
               AND r2.role_name IN (
                 'ROLE_ACCOUNTANT', 'ROLE_CHIEF_ACCOUNTANT',
                 'ROLE_ADMIN'
               )
           )
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc077Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC077_USERNAME ?? "testemployee",
  ) {
    this.username = username;
  }
}
