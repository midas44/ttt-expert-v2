declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-082: Admin role — full access across pages.
 * Finds a user with ROLE_ADMIN.
 */
export class VacationTc082Data {
  readonly adminLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc082Data> {
    if (mode === "static") return new VacationTc082Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_ADMIN'
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc082Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    adminLogin = process.env.VACATION_TC082_ADMIN ?? "pvaynmaster",
  ) {
    this.adminLogin = adminLogin;
  }
}
