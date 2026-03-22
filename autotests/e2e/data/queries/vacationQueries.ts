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

/** Returns the login of a random enabled employee with sufficient vacation days and a manager. */
export async function findEmployeeWithVacationDays(
  db: DbClient,
  minDays: number,
): Promise<string> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.login
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
     WHERE ev.available_vacation_days >= $1
       AND e.enabled = true
       AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
       AND e.manager IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
    [minDays],
  );
  return row.login;
}

interface VacationRow {
  login: string;
  vacation_id: number;
  start_date: string;
  end_date: string;
}

/** Returns a random employee with a vacation in the specified status. */
export async function findEmployeeWithVacation(
  db: DbClient,
  status: string,
  futureOnly = false,
  minAvailableDays = 0,
): Promise<VacationRow> {
  const futureClause = futureOnly ? "AND v.start_date > CURRENT_DATE" : "";
  const daysClause =
    minAvailableDays > 0
      ? `AND EXISTS (
           SELECT 1 FROM ttt_vacation.employee_vacation ev
           WHERE ev.employee = e.id
             AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
             AND ev.available_vacation_days >= ${minAvailableDays}
         )`
      : "";
  return db.queryOne<VacationRow>(
    `SELECT e.login, v.id AS vacation_id, v.start_date::text, v.end_date::text
     FROM ttt_vacation.vacation v
     JOIN ttt_vacation.employee e ON v.employee = e.id
     WHERE v.status = $1
       AND e.enabled = true
       ${futureClause}
       ${daysClause}
     ORDER BY random()
     LIMIT 1`,
    [status],
  );
}

/** Returns a random employee who has both open and closed vacations. */
export async function findEmployeeWithOpenAndClosedVacations(
  db: DbClient,
): Promise<string> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.login
     FROM ttt_vacation.employee e
     WHERE e.enabled = true
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.vacation v
         WHERE v.employee = e.id AND v.status IN ('NEW', 'APPROVED')
       )
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.vacation v
         WHERE v.employee = e.id AND v.status IN ('PAID', 'CANCELED', 'REJECTED', 'DELETED', 'FINISHED')
       )
     ORDER BY random()
     LIMIT 1`,
  );
  return row.login;
}

interface EmployeeWithColleagueRow {
  creator_login: string;
  colleague_login: string;
  colleague_name: string;
}

/** Returns an employee with sufficient days + a colleague in the same office (with name). */
export async function findEmployeeWithColleague(
  db: DbClient,
  minDays: number,
): Promise<EmployeeWithColleagueRow> {
  return db.queryOne<EmployeeWithColleagueRow>(
    `SELECT e1.login AS creator_login,
            e2.login AS colleague_login,
            COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e2.login) AS colleague_name
     FROM ttt_vacation.employee e1
     JOIN ttt_vacation.employee_vacation ev ON e1.id = ev.employee
     JOIN ttt_vacation.employee e2 ON e1.office_id = e2.office_id AND e1.id != e2.id
     LEFT JOIN ttt_backend.employee be ON be.login = e2.login
     WHERE e1.enabled = true
       AND e2.enabled = true
       AND ev.available_vacation_days >= $1
       AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
       AND e1.manager IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
    [minDays],
  );
}

/** Returns the login of a random enabled employee with at least minCount vacations. */
export async function findEmployeeWithMultipleVacations(
  db: DbClient,
  minCount: number,
): Promise<string> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.login
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.vacation v ON v.employee = e.id
     WHERE e.enabled = true
     GROUP BY e.login
     HAVING COUNT(*) >= $1
     ORDER BY random()
     LIMIT 1`,
    [minCount],
  );
  return row.login;
}

/** Returns the login of an employee with both Regular and Administrative vacations. */
export async function findEmployeeWithMixedTypeVacations(
  db: DbClient,
): Promise<string> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.login
     FROM ttt_vacation.employee e
     WHERE e.enabled = true
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.vacation v
         WHERE v.employee = e.id AND v.payment_type = 'REGULAR'
       )
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.vacation v
         WHERE v.employee = e.id AND v.payment_type = 'ADMINISTRATIVE'
       )
     ORDER BY random()
     LIMIT 1`,
  );
  return row.login;
}

/** Returns an employee with vacation balance in 2+ years, plus the year/days breakdown. */
export async function findEmployeeWithMultiYearBalance(
  db: DbClient,
): Promise<{ login: string; entries: { year: number; days: number }[] }> {
  const loginRow = await db.queryOne<EmployeeRow>(
    `SELECT e.login
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
     WHERE e.enabled = true
       AND ev.available_vacation_days > 0
     GROUP BY e.login
     HAVING COUNT(DISTINCT ev.year) >= 2
     ORDER BY random()
     LIMIT 1`,
  );
  const entries = await db.query<{ year: string; days: string }>(
    `SELECT ev.year::text AS year, ev.available_vacation_days::text AS days
     FROM ttt_vacation.employee_vacation ev
     JOIN ttt_vacation.employee e ON e.id = ev.employee
     WHERE e.login = $1
       AND ev.available_vacation_days > 0
     ORDER BY ev.year`,
    [loginRow.login],
  );
  return {
    login: loginRow.login,
    entries: entries.map((e) => ({
      year: parseInt(e.year, 10),
      days: parseInt(e.days, 10),
    })),
  };
}

/** Counts notify-also entries for a vacation identified by employee login and date range. */
export async function countVacationNotifyAlso(
  db: DbClient,
  login: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const row = await db.queryOne<ConflictRow>(
    `SELECT COUNT(*)::text AS cnt
     FROM ttt_vacation.vacation_notify_also vna
     JOIN ttt_vacation.vacation v ON vna.vacation = v.id
     JOIN ttt_vacation.employee e ON v.employee = e.id
     WHERE e.login = $1
       AND v.start_date = $2::date
       AND v.end_date = $3::date`,
    [login, startDate, endDate],
  );
  return Number(row.cnt);
}

interface EmployeeWithManagerRow {
  employee_login: string;
  manager_login: string;
  employee_name: string;
}

/** Returns a random employee with sufficient days, their manager login, and display name. */
export async function findEmployeeWithManager(
  db: DbClient,
  minDays: number,
): Promise<EmployeeWithManagerRow> {
  return db.queryOne<EmployeeWithManagerRow>(
    `SELECT e.login AS employee_login,
            m.login AS manager_login,
            COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS employee_name
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
     JOIN ttt_vacation.employee m ON e.manager = m.id
     LEFT JOIN ttt_backend.employee be ON be.login = e.login
     WHERE e.enabled = true
       AND m.enabled = true
       AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
       AND (ev.available_vacation_days - COALESCE(
         (SELECT SUM(v.regular_days)
          FROM ttt_vacation.vacation v
          WHERE v.employee = e.id
            AND v.status IN ('NEW', 'APPROVED')),
         0)) >= $1
     ORDER BY random()
     LIMIT 1`,
    [minDays],
  );
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
