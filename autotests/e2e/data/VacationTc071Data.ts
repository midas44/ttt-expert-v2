declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-071: Verify chart search by employee.
 * Needs a viewer (department manager) and a known employee name to search for.
 */
export class VacationTc071Data {
  readonly viewerLogin: string;
  readonly searchFirstName: string;
  readonly searchLastName: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc071Data> {
    if (mode === "static") return new VacationTc071Data();

    const db = new DbClient(tttConfig);
    try {
      // Pick a department manager as viewer
      const viewer = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
         ORDER BY random()
         LIMIT 1`,
      );

      // Pick a random enabled employee with a latin name (will appear on chart)
      const emp = await db.queryOne<{
        first_name: string;
        last_name: string;
      }>(
        `SELECT be.latin_first_name AS first_name, be.latin_last_name AS last_name
         FROM ttt_backend.employee be
         WHERE be.enabled = true
           AND be.latin_first_name IS NOT NULL
           AND be.latin_last_name IS NOT NULL
           AND LENGTH(be.latin_last_name) >= 4
         ORDER BY random()
         LIMIT 1`,
      );

      return new VacationTc071Data(
        viewer.login,
        emp.first_name,
        emp.last_name,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    viewerLogin = process.env.VACATION_TC071_VIEWER ?? "pvaynmaster",
    searchFirstName = "Aleksandr",
    searchLastName = "Budin",
  ) {
    this.viewerLogin = viewerLogin;
    this.searchFirstName = searchFirstName;
    this.searchLastName = searchLastName;
  }
}
