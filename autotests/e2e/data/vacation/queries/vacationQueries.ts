import { DbClient } from "../../../config/db/dbClient";

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

/** Returns a random employee with sufficient days, their manager login, and display name.
 *  Excludes contractors and requires ROLE_EMPLOYEE to ensure vacation creation rights. */
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
     JOIN ttt_backend.employee be ON be.login = e.login
     JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
     WHERE e.enabled = true
       AND m.enabled = true
       AND (be.is_contractor IS NULL OR be.is_contractor = false)
       AND r.role_name = 'ROLE_EMPLOYEE'
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

/** Finds the vacation ID for a given employee login and date range. */
export async function findVacationId(
  db: DbClient,
  login: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const row = await db.queryOne<{ id: string }>(
    `SELECT v.id::text AS id
     FROM ttt_vacation.vacation v
     JOIN ttt_vacation.employee e ON e.id = v.employee
     WHERE e.login = $1
       AND v.start_date = $2::date
       AND v.end_date = $3::date
     ORDER BY v.id DESC
     LIMIT 1`,
    [login, startIso, endIso],
  );
  return Number(row.id);
}

/** Returns a non-CPO employee with sufficient days and a manager. */
export async function findNonCpoEmployeeWithManager(
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
     JOIN ttt_backend.employee be ON be.login = e.login
     WHERE e.enabled = true
       AND m.enabled = true
       AND (be.is_contractor IS NULL OR be.is_contractor = false)
       AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
       AND ev.available_vacation_days >= $1
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.employee_global_roles r
         WHERE r.employee = be.id AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
       )
     ORDER BY random()
     LIMIT 1`,
    [minDays],
  );
}

interface CpoEmployeeRow {
  employee_login: string;
  employee_name: string;
  manager_login: string;
  manager_name: string;
}

/** Returns a CPO employee with a manager — identified by having existing self-approved vacations. */
export async function findCpoEmployeeWithManager(
  db: DbClient,
  minDays: number,
): Promise<CpoEmployeeRow> {
  return db.queryOne<CpoEmployeeRow>(
    `SELECT e.login AS employee_login,
            COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS employee_name,
            m.login AS manager_login,
            COALESCE(bm.latin_first_name || ' ' || bm.latin_last_name, m.login) AS manager_name
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
     JOIN ttt_vacation.employee m ON e.manager = m.id
     JOIN ttt_backend.employee be ON be.login = e.login
     JOIN ttt_backend.employee bm ON bm.login = m.login
     WHERE e.enabled = true
       AND m.enabled = true
       AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
       AND ev.available_vacation_days >= $1
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.vacation v
         WHERE v.employee = e.id AND v.approver = e.id
       )
     ORDER BY random()
     LIMIT 1`,
    [minDays],
  );
}

interface SubordinateAndAltManagerRow {
  employee_login: string;
  employee_name: string;
  manager_login: string;
  alt_manager_login: string;
  alt_manager_name: string;
}

/** Returns a subordinate of the given manager + an alternative manager for redirect tests. */
export async function findSubordinateAndAltManager(
  db: DbClient,
  managerLogin: string,
  minDays: number,
): Promise<SubordinateAndAltManagerRow> {
  return db.queryOne<SubordinateAndAltManagerRow>(
    `SELECT e.login AS employee_login,
            COALESCE(be.latin_first_name || ' ' || be.latin_last_name, e.login) AS employee_name,
            m.login AS manager_login,
            m2.login AS alt_manager_login,
            COALESCE(bm2.latin_first_name || ' ' || bm2.latin_last_name, m2.login) AS alt_manager_name
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
     JOIN ttt_vacation.employee m ON e.manager = m.id
     JOIN ttt_backend.employee be ON be.login = e.login
     JOIN ttt_vacation.employee m2 ON m2.enabled = true AND m2.id != m.id AND m2.id != e.id
     JOIN ttt_backend.employee bm2 ON bm2.login = m2.login
     WHERE m.login = $1
       AND e.enabled = true
       AND e.login != $1
       AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
       AND ev.available_vacation_days >= $2
       AND NOT EXISTS (
         SELECT 1 FROM ttt_vacation.vacation v
         WHERE v.employee = e.id
           AND v.status IN ('NEW', 'APPROVED')
           AND v.start_date > CURRENT_DATE
       )
       AND m2.manager IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.employee sub
         WHERE sub.manager = m2.id AND sub.enabled = true
       )
     ORDER BY random()
     LIMIT 1`,
    [managerLogin, minDays],
  );
}

interface AccountantRow {
  login: string;
  display_name: string;
}

/** Returns a random accountant assigned to the given employee's salary office. */
export async function findAccountantForEmployee(
  db: DbClient,
  employeeLogin: string,
): Promise<AccountantRow> {
  return db.queryOne<AccountantRow>(
    `SELECT acct.login,
            COALESCE(be.latin_first_name || ' ' || be.latin_last_name, acct.login) AS display_name
     FROM ttt_vacation.office_accountants oa
     JOIN ttt_vacation.employee acct ON oa.employee = acct.id
     JOIN ttt_backend.employee be ON be.login = acct.login
     JOIN ttt_vacation.employee target ON target.office_id = oa.office
     WHERE target.login = $1
       AND acct.enabled = true
       AND acct.login != $1
     ORDER BY random()
     LIMIT 1`,
    [employeeLogin],
  );
}

interface OptionalApproverRow {
  login: string;
  display_name: string;
}

/** Finds a random enabled employee suitable as optional approver for the given employee. */
export async function findOptionalApproverFor(
  db: DbClient,
  employeeLogin: string,
): Promise<OptionalApproverRow> {
  return db.queryOne<OptionalApproverRow>(
    `SELECT oa.login,
            COALESCE(bm.latin_first_name || ' ' || bm.latin_last_name, oa.login) AS display_name
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee oa ON oa.enabled = true AND oa.id != e.id AND oa.id != e.manager
     JOIN ttt_backend.employee bm ON bm.login = oa.login
     WHERE e.login = $1
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.employee sub
         WHERE sub.manager = oa.id AND sub.enabled = true
       )
     ORDER BY random()
     LIMIT 1`,
    [employeeLogin],
  );
}

interface EmployeeWithLimitedDaysRow {
  login: string;
  available_days: number;
}

/** Returns an employee with limited vacation days (1-5) for insufficient-days tests. */
export async function findEmployeeWithLimitedDays(
  db: DbClient,
): Promise<EmployeeWithLimitedDaysRow> {
  return db.queryOne<EmployeeWithLimitedDaysRow>(
    `SELECT e.login,
            ev.available_vacation_days::int AS available_days
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
     WHERE ev.available_vacation_days BETWEEN 1 AND 5
       AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
       AND e.enabled = true
       AND e.manager IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Finds two non-overlapping conflict-free Mon-Fri weeks for an employee.
 * Returns both weeks guaranteed to not overlap with each other or existing vacations.
 */
export async function findTwoAvailableWeekSlots(
  db: DbClient,
  login: string,
  weeksAhead = 4,
  maxAttempts = 40,
): Promise<{ week1Start: string; week1End: string; week2Start: string; week2End: string }> {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const base = new Date(now);
  base.setDate(now.getDate() + daysToMon + weeksAhead * 7);

  let week1: { start: string; end: string } | null = null;

  for (let i = 0; i < maxAttempts; i++) {
    const start = new Date(base);
    start.setDate(base.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);

    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);

    if (await hasVacationConflict(db, login, startIso, endIso)) continue;

    if (!week1) {
      week1 = { start: startIso, end: endIso };
    } else {
      return {
        week1Start: week1.start,
        week1End: week1.end,
        week2Start: startIso,
        week2End: endIso,
      };
    }
  }
  throw new Error(`Could not find two conflict-free weeks for ${login}`);
}

/**
 * Finds three non-overlapping conflict-free Mon-Fri weeks for an employee.
 * Returns all three weeks guaranteed to not overlap with each other or existing vacations.
 */
export async function findThreeAvailableWeekSlots(
  db: DbClient,
  login: string,
  weeksAhead = 4,
  maxAttempts = 60,
): Promise<{ week1Start: string; week1End: string; week2Start: string; week2End: string; week3Start: string; week3End: string }> {
  const now = new Date();
  const day = now.getDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const base = new Date(now);
  base.setDate(now.getDate() + daysToMon + weeksAhead * 7);

  const weeks: { start: string; end: string }[] = [];

  for (let i = 0; i < maxAttempts && weeks.length < 3; i++) {
    const start = new Date(base);
    start.setDate(base.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);

    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);

    if (await hasVacationConflict(db, login, startIso, endIso)) continue;
    weeks.push({ start: startIso, end: endIso });
  }

  if (weeks.length < 3) throw new Error(`Could not find 3 conflict-free weeks for ${login}`);

  return {
    week1Start: weeks[0].start,
    week1End: weeks[0].end,
    week2Start: weeks[1].start,
    week2End: weeks[1].end,
    week3Start: weeks[2].start,
    week3End: weeks[2].end,
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
       AND v.end_date >= $2::date
       AND v.status NOT IN ('DELETED', 'CANCELED', 'REJECTED')`,
    [login, startIso, endIso],
  );
  return Number(row.cnt) > 0;
}
