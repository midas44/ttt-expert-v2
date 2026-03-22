declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-076: Accountant can access Payment page.
 * Finds a user with ROLE_ACCOUNTANT or ROLE_CHIEF_ACCOUNTANT.
 */
export class VacationTc076Data {
  readonly accountantLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc076Data> {
    if (mode === "static") return new VacationTc076Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name IN ('ROLE_ACCOUNTANT', 'ROLE_CHIEF_ACCOUNTANT')
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc076Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    accountantLogin = process.env.VACATION_TC076_ACCOUNTANT ?? "perekrest",
  ) {
    this.accountantLogin = accountantLogin;
  }
}
