declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

interface TwoManagersRow {
  employee_login: string;
  employee_name: string;
  approver_login: string;
  other_manager_login: string;
}

/**
 * TC-VAC-079: Non-approver cannot approve/reject vacation.
 * Finds a NEW vacation assigned to Manager A, then logs in as Manager B
 * (a different manager) to verify the vacation does NOT appear in their Approval list.
 */
export class VacationTc079Data {
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly approverLogin: string;
  readonly otherManagerLogin: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc079Data> {
    if (mode === "static") return new VacationTc079Data();

    const db = new DbClient(tttConfig);
    try {
      // Find a NEW vacation with an approver, then a different manager
      const row = await db.queryOne<TwoManagersRow>(
        `SELECT e.login AS employee_login,
                COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS employee_name,
                approver.login AS approver_login,
                other_ve.login AS other_manager_login
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         JOIN ttt_vacation.employee approver ON v.approver = approver.id
         JOIN ttt_backend.employee be ON be.login = e.login
         JOIN ttt_vacation.employee other_ve ON other_ve.enabled = true
                AND other_ve.id != approver.id
                AND other_ve.id != e.id
         JOIN ttt_backend.employee other_be ON other_be.login = other_ve.login
                AND other_be.enabled = true
         JOIN ttt_backend.employee_global_roles ogr ON ogr.employee = other_be.id
                AND ogr.role_name = 'ROLE_DEPARTMENT_MANAGER'
         WHERE v.status = 'NEW'
           AND e.enabled = true
           AND approver.enabled = true
           AND v.start_date > CURRENT_DATE
         ORDER BY random()
         LIMIT 1`,
      );

      return new VacationTc079Data(
        row.employee_login,
        row.employee_name,
        row.approver_login,
        row.other_manager_login,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    employeeLogin = process.env.VACATION_TC079_EMPLOYEE ?? "amelnikova",
    employeeName = "Anna Melnikova",
    approverLogin = process.env.VACATION_TC079_APPROVER ?? "pvaynmaster",
    otherManagerLogin = process.env.VACATION_TC079_OTHER_MANAGER ?? "alantsov",
  ) {
    this.employeeLogin = employeeLogin;
    this.employeeName = employeeName;
    this.approverLogin = approverLogin;
    this.otherManagerLogin = otherManagerLogin;
  }
}
