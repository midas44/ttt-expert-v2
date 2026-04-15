import { DbClient } from "@ttt/config/db/dbClient";

interface EmployeeWithManagerRow {
  employee_login: string;
  manager_login: string;
}

/** Finds a random enabled employee with a manager (needed for sick leave CRUD). */
export async function findEmployeeWithManager(
  db: DbClient,
): Promise<EmployeeWithManagerRow> {
  return db.queryOne<EmployeeWithManagerRow>(
    `SELECT e.login AS employee_login, m.login AS manager_login
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee m ON e.manager = m.id
     WHERE e.enabled = true
       AND e.manager IS NOT NULL
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
     ORDER BY random()
     LIMIT 1`,
  );
}

interface ConflictRow {
  cnt: string;
}

/** Checks if a sick leave conflict exists for the given employee and date range. */
export async function hasSickLeaveConflict(
  db: DbClient,
  login: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const row = await db.queryOne<ConflictRow>(
    `SELECT COUNT(*)::text AS cnt
     FROM ttt_vacation.sick_leave sl
     JOIN ttt_vacation.employee e ON sl.employee = e.id
     WHERE e.login = $1
       AND sl.status NOT IN ('DELETED', 'REJECTED')
       AND sl.start_date <= $3::date
       AND sl.end_date >= $2::date`,
    [login, startDate, endDate],
  );
  return parseInt(row.cnt, 10) > 0;
}

/** Checks if a vacation conflict exists for the given employee and date range. */
export async function hasVacationConflict(
  db: DbClient,
  login: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const row = await db.queryOne<ConflictRow>(
    `SELECT COUNT(*)::text AS cnt
     FROM ttt_vacation.vacation v
     JOIN ttt_vacation.employee e ON v.employee = e.id
     WHERE e.login = $1
       AND v.status NOT IN ('CANCELED', 'REJECTED')
       AND v.start_date <= $3::date
       AND v.end_date >= $2::date`,
    [login, startDate, endDate],
  );
  return parseInt(row.cnt, 10) > 0;
}

interface SickLeaveRow {
  id: number;
  status: string;
  accounting_status: string;
}

/** Finds a sick leave by employee login and date range. */
export async function findSickLeave(
  db: DbClient,
  login: string,
  startDate: string,
  endDate: string,
): Promise<SickLeaveRow | null> {
  return db.queryOneOrNull<SickLeaveRow>(
    `SELECT sl.id, sl.status, sl.accounting_status
     FROM ttt_vacation.sick_leave sl
     JOIN ttt_vacation.employee e ON sl.employee = e.id
     WHERE e.login = $1
       AND sl.start_date = $2::date
       AND sl.end_date = $3::date
       AND sl.status != 'DELETED'
     ORDER BY sl.id DESC
     LIMIT 1`,
    [login, startDate, endDate],
  );
}
