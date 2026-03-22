declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-075: Manager can view and act on Employee Requests.
 * Finds a project manager who is an approver for at least one vacation request.
 */
export class VacationTc075Data {
  readonly managerLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc075Data> {
    if (mode === "static") return new VacationTc075Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{ login: string }>(
        `SELECT m.login
         FROM ttt_vacation.employee m
         WHERE m.enabled = true
           AND m.login != 'pvaynmaster'
           AND EXISTS (
             SELECT 1 FROM ttt_vacation.employee e
             JOIN ttt_vacation.vacation v ON v.employee = e.id
             WHERE e.manager = m.id AND v.status = 'NEW'
           )
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc075Data(row.login);
    } finally {
      await db.close();
    }
  }

  constructor(
    managerLogin = process.env.VACATION_TC075_MANAGER ?? "dvovney",
  ) {
    this.managerLogin = managerLogin;
  }
}
