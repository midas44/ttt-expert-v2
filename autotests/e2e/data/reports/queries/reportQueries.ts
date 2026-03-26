import { DbClient } from "../../../config/db/dbClient";

interface EmployeeWithProjectRow {
  login: string;
  project_name: string;
}

/** Returns a random enabled employee who is a member of an active project (name >= 3 chars). */
export async function findEmployeeWithProject(
  db: DbClient,
): Promise<{ login: string; projectName: string }> {
  const row = await db.queryOne<EmployeeWithProjectRow>(
    `SELECT e.login, p.name AS project_name
     FROM ttt_backend.employee e
     JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
     JOIN ttt_backend.project_member pm ON pm.employee = e.id
     JOIN ttt_backend.project p ON p.id = pm.project
     WHERE e.enabled = true
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND r.role_name = 'ROLE_EMPLOYEE'
       AND p.status = 'ACTIVE'
       AND length(p.name) >= 3
     ORDER BY random()
     LIMIT 1`,
  );
  return { login: row.login, projectName: row.project_name };
}
