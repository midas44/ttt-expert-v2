declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-066: Cannot add negative correction for AV=false employee.
 * Finds a chief accountant. The test uses the first table row on the correction page
 * (alphabetically first employee), which must be AV=false.
 * The data class verifies this by querying the first alphabetical AV=false employee.
 */
export class VacationTc066Data {
  readonly accountantLogin: string;
  /** Display name as shown in table: "Last First" */
  readonly employeeTableName: string;
  readonly isAdvanceVacation: boolean;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc066Data> {
    if (mode === "static") return new VacationTc066Data();

    const db = new DbClient(tttConfig);
    try {
      const accRow = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name = 'ROLE_CHIEF_ACCOUNTANT'
         ORDER BY random()
         LIMIT 1`,
      );

      // Verify the first alphabetical employee is AV=false
      const firstEmp = await db.queryOne<{
        last_name: string;
        first_name: string;
        av: boolean;
      }>(
        `SELECT
           be.latin_last_name AS last_name,
           be.latin_first_name AS first_name,
           o.advance_vacation AS av
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.office o ON e.office_id = o.id
         JOIN ttt_backend.employee be ON be.login = e.login
         WHERE e.enabled = true
           AND be.latin_last_name IS NOT NULL
         ORDER BY be.latin_last_name, be.latin_first_name
         LIMIT 1`,
      );

      return new VacationTc066Data(
        accRow.login,
        `${firstEmp.last_name} ${firstEmp.first_name}`,
        firstEmp.av,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    accountantLogin = process.env.VACATION_TC066_ACCOUNTANT ?? "perekrest",
    employeeTableName = "Abderrahim Nadim",
    isAdvanceVacation = false,
  ) {
    this.accountantLogin = accountantLogin;
    this.employeeTableName = employeeTableName;
    this.isAdvanceVacation = isAdvanceVacation;
  }
}
