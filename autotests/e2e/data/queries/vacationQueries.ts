import { DbClient } from "../../config/db/dbClient";

interface EmployeeRow {
  login: string;
}

interface ConflictRow {
  cnt: string;
}

/** Returns the login of a random enabled, non-contractor employee with ROLE_EMPLOYEE. */
export async function findRandomEmployee(db: DbClient): Promise<string> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.login
     FROM ttt_backend.employee e
     JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
     WHERE e.enabled = true
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND r.role_name = 'ROLE_EMPLOYEE'
     ORDER BY random()
     LIMIT 1`,
  );
  return row.login;
}

/** Checks whether a vacation overlaps with existing vacations for the given login. */
export async function hasVacationConflict(
  db: DbClient,
  login: string,
  startIso: string,
  endIso: string,
): Promise<boolean> {
  const row = await db.queryOne<ConflictRow>(
    `SELECT count(*)::text AS cnt
     FROM ttt_vacation.vacation v
     JOIN ttt_vacation.employee ve ON ve.id = v.employee
     WHERE ve.login = $1
       AND v.start_date <= $3::date
       AND v.end_date >= $2::date`,
    [login, startIso, endIso],
  );
  return Number(row.cnt) > 0;
}
