import { DbClient } from "@ttt/config/db/dbClient";

interface EmployeeWithOfficeRow {
  login: string;
  manager_login: string | null;
  office_id: number;
  advance_vacation: boolean;
}

interface OfficeRow {
  id: number;
}

/**
 * Finds a random enabled employee in an AV=false office with sufficient vacation days.
 * Returns employee login, manager login, and office info.
 */
export async function findEmployeeAvFalse(
  db: DbClient,
  minDays: number = 5,
): Promise<EmployeeWithOfficeRow> {
  const row = await db.queryOne<EmployeeWithOfficeRow>(
    `SELECT e.login,
            mgr.login AS manager_login,
            vo.id AS office_id,
            vo.advance_vacation
     FROM ttt_backend.employee e
     JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
     JOIN ttt_vacation.employee ve ON ve.login = e.login
     JOIN ttt_vacation.office vo ON vo.id = ve.office_id
     LEFT JOIN ttt_backend.employee mgr ON mgr.id = e.senior_manager
     WHERE e.enabled = true
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND r.role_name = 'ROLE_EMPLOYEE'
       AND vo.advance_vacation = false
     ORDER BY random()
     LIMIT 1`,
  );
  return row;
}

/**
 * Finds a random enabled employee who has a manager (needed for approve/reject tests).
 * The manager must also be enabled.
 */
export async function findEmployeeWithManager(
  db: DbClient,
): Promise<{ login: string; managerLogin: string; officeId: number }> {
  const row = await db.queryOne<{
    login: string;
    manager_login: string;
    office_id: number;
  }>(
    `SELECT e.login,
            mgr.login AS manager_login,
            vo.id AS office_id
     FROM ttt_backend.employee e
     JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
     JOIN ttt_vacation.employee ve ON ve.login = e.login
     JOIN ttt_vacation.office vo ON vo.id = ve.office_id
     JOIN ttt_backend.employee mgr ON mgr.id = e.senior_manager AND mgr.enabled = true
     WHERE e.enabled = true
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND r.role_name = 'ROLE_EMPLOYEE'
       AND vo.advance_vacation = false
       AND e.senior_manager IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
  return {
    login: row.login,
    managerLogin: row.manager_login,
    officeId: row.office_id,
  };
}

/**
 * Finds a random enabled CPO (ROLE_DEPARTMENT_MANAGER) employee with a manager.
 * Needed for TC-VAC-015 (null optionalApprovers NPE on CPO path).
 */
export async function findCpoEmployee(
  db: DbClient,
): Promise<{ login: string; managerLogin: string; officeId: number }> {
  const row = await db.queryOne<{
    login: string;
    manager_login: string;
    office_id: number;
  }>(
    `SELECT e.login,
            mgr.login AS manager_login,
            vo.id AS office_id
     FROM ttt_backend.employee e
     JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
     JOIN ttt_vacation.employee ve ON ve.login = e.login
     JOIN ttt_vacation.office vo ON vo.id = ve.office_id
     JOIN ttt_backend.employee mgr ON mgr.id = e.senior_manager AND mgr.enabled = true
     WHERE e.enabled = true
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
       AND e.senior_manager IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
  return {
    login: row.login,
    managerLogin: row.manager_login,
    officeId: row.office_id,
  };
}

/** Returns a random valid office ID. */
export async function findRandomOfficeId(db: DbClient): Promise<number> {
  const row = await db.queryOne<OfficeRow>(
    `SELECT id FROM ttt_vacation.office ORDER BY random() LIMIT 1`,
  );
  return row.id;
}
