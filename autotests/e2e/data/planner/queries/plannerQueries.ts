import { DbClient } from "../../../config/db/dbClient";

interface EnabledEmployeeRow {
  login: string;
}

/** Finds a random enabled employee for basic planner access tests. */
export async function findEnabledEmployee(
  db: DbClient,
): Promise<EnabledEmployeeRow> {
  return db.queryOne<EnabledEmployeeRow>(
    `SELECT e.login
     FROM ttt_backend.employee e
     WHERE e.enabled = true
       AND e.login IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
}

interface ProjectManagerRow {
  login: string;
  project_id: number;
  project_name: string;
}

/** Finds a random PM who manages at least one ACTIVE project. */
export async function findProjectManager(
  db: DbClient,
): Promise<ProjectManagerRow> {
  return db.queryOne<ProjectManagerRow>(
    `SELECT e.login,
            p.id AS project_id,
            p.name AS project_name
     FROM ttt_backend.project p
     JOIN ttt_backend.employee e ON p.manager = e.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND e.login IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
}

interface MultiRoleEmployeeRow {
  login: string;
  pm_project_name: string;
  member_project_name: string;
}

/**
 * Finds an employee who is PM on one project and a plain member on another.
 * Used for role filter tests.
 */
export async function findEmployeeWithMultipleRoles(
  db: DbClient,
): Promise<MultiRoleEmployeeRow> {
  return db.queryOne<MultiRoleEmployeeRow>(
    `WITH pm_projects AS (
       SELECT e.id AS emp_id, e.login, p.name AS pm_project_name
       FROM ttt_backend.employee e
       JOIN ttt_backend.project p ON p.manager = e.id
       WHERE e.enabled = true
         AND p.status = 'ACTIVE'
         AND e.login IS NOT NULL
     ),
     member_projects AS (
       SELECT pe.employee_id, p.name AS member_project_name
       FROM ttt_backend.project_employee pe
       JOIN ttt_backend.project p ON pe.project_id = p.id
       WHERE p.status = 'ACTIVE'
     )
     SELECT pm.login,
            pm.pm_project_name,
            mp.member_project_name
     FROM pm_projects pm
     JOIN member_projects mp ON mp.employee_id = pm.emp_id
       AND mp.member_project_name != pm.pm_project_name
     ORDER BY random()
     LIMIT 1`,
  );
}
