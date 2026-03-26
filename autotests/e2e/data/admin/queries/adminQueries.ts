import { DbClient } from "../../config/db/dbClient";

interface AdminRow {
  login: string;
  display_name: string;
}

/** Returns a random enabled admin employee with their display name. */
export async function findAdminEmployee(
  db: DbClient,
): Promise<{ login: string; displayName: string }> {
  const row = await db.queryOne<AdminRow>(
    `SELECT e.login, e.name AS display_name
     FROM ttt_backend.employee e
     JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
     WHERE e.enabled = true
       AND r.role_name = 'ROLE_ADMIN'
       AND e.name IS NOT NULL
       AND length(trim(e.name)) > 0
     ORDER BY random()
     LIMIT 1`,
  );
  return { login: row.login, displayName: row.display_name };
}
