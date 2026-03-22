declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-078: ReadOnly user cannot create vacation.
 * Finds an employee with read_only = true.
 */
export class VacationTc078Data {
  readonly readOnlyLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc078Data> {
    if (mode === "static") return new VacationTc078Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         WHERE be.read_only = true
           AND be.enabled = true
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc078Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    readOnlyLogin = process.env.VACATION_TC078_USERNAME ?? "readonly_user",
  ) {
    this.readOnlyLogin = readOnlyLogin;
  }
}
