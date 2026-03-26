import { DbClient } from "../../config/db/dbClient";

interface EmployeeRow {
  login: string;
}

interface DayOffRow {
  login: string;
  original_date: string;
  duration: number;
}

interface DayOffRequestRow {
  login: string;
  request_id: number;
  personal_date: string;
  original_date: string;
  status: string;
}

/**
 * Returns a random enabled employee who has employee_dayoff entries
 * (public holidays synced for their office).
 */
export async function findEmployeeWithDayoffs(
  db: DbClient,
): Promise<EmployeeRow> {
  return db.queryOne<EmployeeRow>(
    `SELECT e.login
     FROM ttt_vacation.employee e
     WHERE e.enabled = true
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.employee_dayoff ed
         WHERE ed.employee = e.id
       )
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Returns a random employee with a future public holiday (duration=0)
 * that has no existing active transfer request — suitable for creating a new one.
 * Queries the production calendar (ttt_calendar.calendar_days) via the employee's
 * office, since employee_dayoff only tracks already-processed transfers.
 */
export async function findFreeHolidayForTransfer(
  db: DbClient,
): Promise<{ login: string; public_date: string }> {
  return db.queryOne<{ login: string; public_date: string }>(
    `SELECT e.login, cd.calendar_date::text AS public_date
     FROM ttt_vacation.employee e
     JOIN ttt_calendar.office_calendar oc ON oc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = oc.calendar_id
     WHERE e.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date > CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM ttt_calendar.office_calendar oc2
         WHERE oc2.office_id = oc.office_id
           AND oc2.since_year > oc.since_year
           AND oc2.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
       )
       AND oc.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
       AND NOT EXISTS (
         SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
         WHERE edr.employee = e.id
           AND edr.original_date = cd.calendar_date
           AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
       )
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Returns a random employee with an existing transfer request in the given status.
 */
export async function findEmployeeWithDayOffRequest(
  db: DbClient,
  status: string,
): Promise<DayOffRequestRow> {
  return db.queryOne<DayOffRequestRow>(
    `SELECT e.login,
            edr.id AS request_id,
            edr.personal_date::text,
            edr.original_date::text,
            edr.status
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee_dayoff_request edr ON edr.employee = e.id
     WHERE edr.status = $1
       AND e.enabled = true
     ORDER BY random()
     LIMIT 1`,
    [status],
  );
}

/**
 * Returns the count of employee_dayoff entries for a given employee login and year.
 */
export async function countEmployeeDayoffs(
  db: DbClient,
  login: string,
  year: number,
): Promise<number> {
  const row = await db.queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
     FROM ttt_vacation.employee_dayoff ed
     JOIN ttt_vacation.employee e ON ed.employee = e.id
     WHERE e.login = $1
       AND EXTRACT(YEAR FROM ed.original_date) = $2`,
    [login, year],
  );
  return Number(row.cnt);
}

/**
 * Returns the office name for a given employee login.
 */
export async function getEmployeeOfficeName(
  db: DbClient,
  login: string,
): Promise<string> {
  const row = await db.queryOne<{ name: string }>(
    `SELECT o.name
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.office o ON e.office_id = o.id
     WHERE e.login = $1`,
    [login],
  );
  return row.name;
}

/**
 * Finds a future working day (not weekend, not an existing holiday in the
 * production calendar) for a given employee, suitable as a transfer target date.
 * Returns ISO date string.
 */
export async function findFutureWorkingDay(
  db: DbClient,
  login: string,
  afterDate: string,
): Promise<string> {
  const row = await db.queryOne<{ working_date: string }>(
    `WITH dates AS (
       SELECT generate_series(
         ($2::date + INTERVAL '7 days')::date,
         ($2::date + INTERVAL '60 days')::date,
         '1 day'::interval
       )::date AS d
     )
     SELECT d::text AS working_date
     FROM dates
     WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
       AND NOT EXISTS (
         SELECT 1 FROM ttt_calendar.office_calendar oc
         JOIN ttt_vacation.employee e ON e.office_id = oc.office_id
         JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = oc.calendar_id
         WHERE e.login = $1 AND cd.calendar_date = d AND cd.duration = 0
       )
     ORDER BY d
     LIMIT 1`,
    [login, afterDate],
  );
  return row.working_date;
}

/**
 * Finds an employee with a future d=0 holiday (no active transfer request)
 * AND a past holiday row. For edit button visibility test (TC-DO-011).
 */
export async function findEmployeeWithFutureAndPastHolidays(
  db: DbClient,
): Promise<{ login: string; future_date: string; past_date: string }> {
  return db.queryOne<{ login: string; future_date: string; past_date: string }>(
    `SELECT sub.login, sub.future_date, sub.past_date
     FROM (
       SELECT e.login,
              (SELECT cd1.calendar_date::text
               FROM ttt_calendar.calendar_days cd1
               JOIN ttt_calendar.office_calendar oc1 ON oc1.calendar_id = cd1.calendar_id
                 AND oc1.office_id = e.office_id
               WHERE cd1.calendar_date > CURRENT_DATE
                 AND cd1.duration = 0
                 AND NOT EXISTS (
                   SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
                   WHERE edr.employee = e.id
                     AND edr.original_date = cd1.calendar_date
                     AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
                 )
               ORDER BY cd1.calendar_date
               LIMIT 1) AS future_date,
              (SELECT cd2.calendar_date::text
               FROM ttt_calendar.calendar_days cd2
               JOIN ttt_calendar.office_calendar oc2 ON oc2.calendar_id = cd2.calendar_id
                 AND oc2.office_id = e.office_id
               WHERE cd2.calendar_date < CURRENT_DATE
               ORDER BY cd2.calendar_date DESC
               LIMIT 1) AS past_date
       FROM ttt_vacation.employee e
       WHERE e.enabled = true
     ) sub
     WHERE sub.future_date IS NOT NULL AND sub.past_date IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Returns a random employee with a future holiday (duration=0) from the employee_dayoff
 * table (the actual source used by the UI), with no active transfer request.
 * More reliable than findFreeHolidayForTransfer which uses calendar_days.
 */
export async function findFreeHolidayFromDayoffTable(
  db: DbClient,
): Promise<{ login: string; public_date: string }> {
  return db.queryOne<{ login: string; public_date: string }>(
    `SELECT e.login, ed.original_date::text AS public_date
     FROM ttt_vacation.employee_dayoff ed
     JOIN ttt_vacation.employee e ON ed.employee = e.id
     WHERE e.enabled = true
       AND ed.duration = 0
       AND ed.original_date > CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
         WHERE edr.employee = e.id
           AND edr.original_date = ed.original_date
           AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
       )
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Finds a manager-subordinate pair where the subordinate has a future d=0 holiday
 * available for transfer request creation. Used for approval flow tests.
 */
export async function findManagerSubordinateWithFreeHoliday(
  db: DbClient,
): Promise<{
  managerLogin: string;
  employeeLogin: string;
  publicDate: string;
}> {
  return db.queryOne<{
    managerLogin: string;
    employeeLogin: string;
    publicDate: string;
  }>(
    `SELECT m.login AS "managerLogin",
            e.login AS "employeeLogin",
            ed.original_date::text AS "publicDate"
     FROM ttt_vacation.employee_dayoff ed
     JOIN ttt_vacation.employee e ON ed.employee = e.id
     JOIN ttt_vacation.employee m ON e.manager = m.id
     WHERE e.enabled = true
       AND m.enabled = true
       AND ed.duration = 0
       AND ed.original_date > CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
         WHERE edr.employee = e.id
           AND edr.original_date = ed.original_date
           AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
       )
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Finds an existing NEW day-off transfer request with the manager who should approve it.
 * Only returns managers who have ROLE_PROJECT_MANAGER or higher (required for /vacation/request page).
 * Returns the request id, employee login/name, manager login, and dates.
 */
export async function findNewDayoffRequestWithManager(
  db: DbClient,
): Promise<{
  requestId: number;
  employeeLogin: string;
  employeeName: string;
  managerLogin: string;
  originalDate: string;
  personalDate: string;
} | null> {
  try {
    return await db.queryOne<{
      requestId: number;
      employeeLogin: string;
      employeeName: string;
      managerLogin: string;
      originalDate: string;
      personalDate: string;
    }>(
      `SELECT edr.id AS "requestId",
              e.login AS "employeeLogin",
              CONCAT(e.russian_last_name, ' ', e.russian_first_name) AS "employeeName",
              m.login AS "managerLogin",
              edr.original_date::text AS "originalDate",
              edr.personal_date::text AS "personalDate"
       FROM ttt_vacation.employee_dayoff_request edr
       JOIN ttt_vacation.employee e ON edr.employee = e.id
       JOIN ttt_vacation.employee m ON edr.approver = m.id
       WHERE edr.status = 'NEW'
         AND e.enabled = true
         AND m.enabled = true
         AND EXISTS (
           SELECT 1 FROM ttt_backend.employee_global_roles egr
           WHERE egr.employee = m.id
             AND egr.role_name IN (
               'ROLE_PROJECT_MANAGER', 'ROLE_DEPARTMENT_MANAGER',
               'ROLE_TECH_LEAD', 'ROLE_VIEW_ALL', 'ROLE_ADMIN'
             )
         )
       ORDER BY random()
       LIMIT 1`,
    );
  } catch {
    return null;
  }
}

/**
 * Finds another enabled manager (different from the given login)
 * who can receive a redirected day-off request.
 */
export async function findAnotherManager(
  db: DbClient,
  excludeLogin: string,
): Promise<{ login: string; fullName: string }> {
  return db.queryOne<{ login: string; fullName: string }>(
    `SELECT m.login,
            CONCAT(m.russian_first_name, ' ', m.russian_last_name) AS "fullName"
     FROM ttt_vacation.employee m
     WHERE m.enabled = true
       AND m.login != $1
       AND EXISTS (
         SELECT 1 FROM ttt_vacation.employee e WHERE e.manager = m.id
       )
     ORDER BY random()
     LIMIT 1`,
    [excludeLogin],
  );
}

/**
 * Creates a NEW day-off transfer request for an employee whose manager has the
 * required role to access the approval page. Used as a fallback when the pool
 * of existing NEW requests is exhausted (e.g., after approve/reject tests).
 */
export async function createNewDayoffRequest(
  db: DbClient,
): Promise<{
  requestId: number;
  employeeLogin: string;
  employeeName: string;
  managerLogin: string;
  originalDate: string;
  personalDate: string;
}> {
  const candidate = await db.queryOne<{
    employeeId: number;
    employeeLogin: string;
    employeeName: string;
    managerId: number;
    managerLogin: string;
    originalDate: string;
  }>(
    `SELECT e.id AS "employeeId",
            e.login AS "employeeLogin",
            CONCAT(e.russian_last_name, ' ', e.russian_first_name) AS "employeeName",
            m.id AS "managerId",
            m.login AS "managerLogin",
            cd.calendar_date::text AS "originalDate"
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee m ON e.manager = m.id
     JOIN ttt_calendar.office_calendar oc ON oc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = oc.calendar_id
     WHERE e.enabled = true
       AND m.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date > CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
         WHERE edr.employee = e.id
           AND edr.original_date = cd.calendar_date
           AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
       )
       AND EXISTS (
         SELECT 1 FROM ttt_backend.employee_global_roles egr
         WHERE egr.employee = m.id
           AND egr.role_name IN (
             'ROLE_PROJECT_MANAGER', 'ROLE_DEPARTMENT_MANAGER',
             'ROLE_TECH_LEAD', 'ROLE_VIEW_ALL', 'ROLE_ADMIN'
           )
       )
     ORDER BY random()
     LIMIT 1`,
  );

  const personalRow = await db.queryOne<{ workingDate: string }>(
    `WITH dates AS (
       SELECT generate_series(
         ($1::date + INTERVAL '7 days')::date,
         ($1::date + INTERVAL '60 days')::date,
         '1 day'::interval
       )::date AS d
     )
     SELECT d::text AS "workingDate"
     FROM dates
     WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
     ORDER BY d
     LIMIT 1`,
    [candidate.originalDate],
  );

  const inserted = await db.queryOne<{ id: number }>(
    `INSERT INTO ttt_vacation.employee_dayoff_request
       (employee, approver, original_date, personal_date, duration, status, creation_date)
     VALUES ($1, $2, $3::date, $4::date, 0, 'NEW', NOW())
     RETURNING id`,
    [
      candidate.employeeId,
      candidate.managerId,
      candidate.originalDate,
      personalRow.workingDate,
    ],
  );

  // Insert timeline event so the request appears on My department tab
  await insertTimelineEvent(
    db, candidate.employeeId, candidate.managerId, inserted.id,
    "EMPLOYEE_DAY_OFF_CREATED", candidate.originalDate, personalRow.workingDate,
  );

  return {
    requestId: inserted.id,
    employeeLogin: candidate.employeeLogin,
    employeeName: candidate.employeeName,
    managerLogin: candidate.managerLogin,
    originalDate: candidate.originalDate,
    personalDate: personalRow.workingDate,
  };
}

/**
 * Finds an existing APPROVED day-off request with the approver manager.
 * Used for TC-DO-023 (My department tab — only info button on APPROVED rows).
 * Returns null if no APPROVED request exists.
 */
export async function findApprovedDayoffRequestWithManager(
  db: DbClient,
): Promise<{
  requestId: number;
  employeeLogin: string;
  employeeName: string;
  managerLogin: string;
  originalDate: string;
  personalDate: string;
} | null> {
  try {
    return await db.queryOne<{
      requestId: number;
      employeeLogin: string;
      employeeName: string;
      managerLogin: string;
      originalDate: string;
      personalDate: string;
    }>(
      `SELECT edr.id AS "requestId",
              e.login AS "employeeLogin",
              CONCAT(e.russian_last_name, ' ', e.russian_first_name) AS "employeeName",
              m.login AS "managerLogin",
              edr.original_date::text AS "originalDate",
              edr.personal_date::text AS "personalDate"
       FROM ttt_vacation.employee_dayoff_request edr
       JOIN ttt_vacation.employee e ON edr.employee = e.id
       JOIN ttt_vacation.employee m ON edr.approver = m.id
       WHERE edr.status = 'APPROVED'
         AND e.enabled = true
         AND m.enabled = true
         AND EXISTS (
           SELECT 1 FROM ttt_backend.employee_global_roles egr
           WHERE egr.employee = m.id
             AND egr.role_name IN (
               'ROLE_PROJECT_MANAGER', 'ROLE_DEPARTMENT_MANAGER',
               'ROLE_TECH_LEAD', 'ROLE_VIEW_ALL', 'ROLE_ADMIN'
             )
         )
       ORDER BY random()
       LIMIT 1`,
    );
  } catch {
    return null;
  }
}

/**
 * Inserts a timeline event for a dayoff request.
 * Required for the request to appear on the My department tab.
 *
 * Mimics the app's EmployeeDayOffTimelineServiceImpl.save() behavior:
 * before inserting a new event, sets fetch_day_off=false on ALL previous
 * events for the same day_off id. Only the latest event should have
 * fetch_day_off=true — the My department tab filters by this flag.
 */
async function insertTimelineEvent(
  db: DbClient,
  employeeId: number,
  approverId: number,
  requestId: number,
  eventType: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  await db.query(
    `UPDATE ttt_vacation.timeline SET fetch_day_off = false
     WHERE day_off = $1 AND fetch_day_off = true`,
    [requestId],
  );
  await db.query(
    `INSERT INTO ttt_vacation.timeline
       (employee, event_time, event_type, day_off, approver, start_date, end_date, fetch_day_off, days_used, days_accrued)
     VALUES ($1, NOW(), $2, $3, $4, $5::date, $6::date, true, 0, 0)`,
    [employeeId, eventType, requestId, approverId, startDate, endDate],
  );
}

/**
 * Creates a NEW day-off request and immediately approves it via DB UPDATE.
 * Also creates a timeline event so the request appears on the My department tab.
 */
export async function createApprovedDayoffRequest(
  db: DbClient,
): Promise<{
  requestId: number;
  employeeLogin: string;
  employeeName: string;
  managerLogin: string;
  originalDate: string;
  personalDate: string;
}> {
  const created = await createNewDayoffRequest(db);
  await db.query(
    `UPDATE ttt_vacation.employee_dayoff_request
     SET status = 'APPROVED'
     WHERE id = $1`,
    [created.requestId],
  );
  // Fetch employee/approver IDs for timeline
  const ids = await db.queryOne<{ employeeId: number; approverId: number }>(
    `SELECT employee AS "employeeId", approver AS "approverId"
     FROM ttt_vacation.employee_dayoff_request WHERE id = $1`,
    [created.requestId],
  );
  await insertTimelineEvent(
    db, ids.employeeId, ids.approverId, created.requestId,
    "EMPLOYEE_DAY_OFF_APPROVED", created.originalDate, created.personalDate,
  );
  return created;
}

/**
 * Creates a NEW day-off request and immediately rejects it via DB UPDATE.
 * Also creates a timeline event so the request appears on the My department tab.
 * Used for TC-DO-028 (reject then re-approve flow).
 */
export async function createRejectedDayoffRequest(
  db: DbClient,
): Promise<{
  requestId: number;
  employeeLogin: string;
  employeeName: string;
  managerLogin: string;
  originalDate: string;
  personalDate: string;
}> {
  const created = await createNewDayoffRequest(db);
  await db.query(
    `UPDATE ttt_vacation.employee_dayoff_request
     SET status = 'REJECTED'
     WHERE id = $1`,
    [created.requestId],
  );
  const ids = await db.queryOne<{ employeeId: number; approverId: number }>(
    `SELECT employee AS "employeeId", approver AS "approverId"
     FROM ttt_vacation.employee_dayoff_request WHERE id = $1`,
    [created.requestId],
  );
  await insertTimelineEvent(
    db, ids.employeeId, ids.approverId, created.requestId,
    "EMPLOYEE_DAY_OFF_REJECTED", created.originalDate, created.personalDate,
  );
  return created;
}

/**
 * Creates a NEW day-off request for an employee who has
 * ROLE_DEPARTMENT_MANAGER or ROLE_PROJECT_MANAGER (CPO).
 * Sets approver = self (the employee), simulating the system's
 * auto-assignment for CPO/department managers.
 */
export async function createCpoSelfAssignedRequest(
  db: DbClient,
): Promise<{
  requestId: number;
  cpoLogin: string;
  cpoName: string;
  originalDate: string;
  personalDate: string;
}> {
  const cpo = await db.queryOne<{
    employeeId: number;
    login: string;
    employeeName: string;
    originalDate: string;
  }>(
    `SELECT e.id AS "employeeId",
            e.login,
            CONCAT(e.russian_last_name, ' ', e.russian_first_name) AS "employeeName",
            cd.calendar_date::text AS "originalDate"
     FROM ttt_vacation.employee e
     JOIN ttt_backend.employee_global_roles egr ON egr.employee = e.id
     JOIN ttt_calendar.office_calendar oc ON oc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = oc.calendar_id
     WHERE e.enabled = true
       AND egr.role_name IN ('ROLE_DEPARTMENT_MANAGER', 'ROLE_PROJECT_MANAGER')
       AND cd.duration = 0
       AND cd.calendar_date > CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
         WHERE edr.employee = e.id
           AND edr.original_date = cd.calendar_date
           AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
       )
     ORDER BY random()
     LIMIT 1`,
  );

  const personalRow = await db.queryOne<{ workingDate: string }>(
    `WITH dates AS (
       SELECT generate_series(
         ($1::date + INTERVAL '7 days')::date,
         ($1::date + INTERVAL '60 days')::date,
         '1 day'::interval
       )::date AS d
     )
     SELECT d::text AS "workingDate"
     FROM dates
     WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
     ORDER BY d
     LIMIT 1`,
    [cpo.originalDate],
  );

  const inserted = await db.queryOne<{ id: number }>(
    `INSERT INTO ttt_vacation.employee_dayoff_request
       (employee, approver, original_date, personal_date, duration, status, creation_date)
     VALUES ($1, $1, $2::date, $3::date, 0, 'NEW', NOW())
     RETURNING id`,
    [cpo.employeeId, cpo.originalDate, personalRow.workingDate],
  );

  // CPO self-assigned: employee = approver
  await insertTimelineEvent(
    db, cpo.employeeId, cpo.employeeId, inserted.id,
    "EMPLOYEE_DAY_OFF_CREATED", cpo.originalDate, personalRow.workingDate,
  );

  return {
    requestId: inserted.id,
    cpoLogin: cpo.login,
    cpoName: cpo.employeeName,
    originalDate: cpo.originalDate,
    personalDate: personalRow.workingDate,
  };
}

/**
 * Finds a CPO (ROLE_DEPARTMENT_MANAGER or ROLE_PROJECT_MANAGER) who has a
 * future holiday available for creating a transfer request (no existing active request).
 * Tries employee_dayoff first (the UI data source), falls back to calendar_days.
 * Read-only — does NOT create any request.
 */
export async function findCpoWithFreeHoliday(
  db: DbClient,
): Promise<{
  cpoLogin: string;
  cpoName: string;
  originalDate: string;
  personalDate: string;
}> {
  let cpo: { login: string; employeeName: string; originalDate: string };
  try {
    cpo = await db.queryOne<{
      login: string;
      employeeName: string;
      originalDate: string;
    }>(
      `SELECT e.login,
              CONCAT(e.russian_last_name, ' ', e.russian_first_name) AS "employeeName",
              ed.original_date::text AS "originalDate"
       FROM ttt_vacation.employee_dayoff ed
       JOIN ttt_vacation.employee e ON ed.employee = e.id
       JOIN ttt_backend.employee_global_roles egr ON egr.employee = e.id
       WHERE e.enabled = true
         AND egr.role_name IN ('ROLE_DEPARTMENT_MANAGER', 'ROLE_PROJECT_MANAGER')
         AND ed.duration = 0
         AND ed.original_date > CURRENT_DATE
         AND NOT EXISTS (
           SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
           WHERE edr.employee = e.id
             AND edr.original_date = ed.original_date
             AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
         )
       ORDER BY random()
       LIMIT 1`,
    );
  } catch {
    // Fallback: use calendar_days when employee_dayoff is exhausted
    cpo = await db.queryOne<{
      login: string;
      employeeName: string;
      originalDate: string;
    }>(
      `SELECT e.login,
              CONCAT(e.russian_last_name, ' ', e.russian_first_name) AS "employeeName",
              cd.calendar_date::text AS "originalDate"
       FROM ttt_vacation.employee e
       JOIN ttt_backend.employee_global_roles egr ON egr.employee = e.id
       JOIN ttt_calendar.office_calendar oc ON oc.office_id = e.office_id
       JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = oc.calendar_id
       WHERE e.enabled = true
         AND egr.role_name IN ('ROLE_DEPARTMENT_MANAGER', 'ROLE_PROJECT_MANAGER')
         AND cd.duration = 0
         AND cd.calendar_date > CURRENT_DATE
         AND NOT EXISTS (
           SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
           WHERE edr.employee = e.id
             AND edr.original_date = cd.calendar_date
             AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
         )
       ORDER BY random()
       LIMIT 1`,
    );
  }

  const personalRow = await db.queryOne<{ workingDate: string }>(
    `WITH dates AS (
       SELECT generate_series(
         ($1::date + INTERVAL '7 days')::date,
         ($1::date + INTERVAL '60 days')::date,
         '1 day'::interval
       )::date AS d
     )
     SELECT d::text AS "workingDate"
     FROM dates
     WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
     ORDER BY d
     LIMIT 1`,
    [cpo.originalDate],
  );

  return {
    cpoLogin: cpo.login,
    cpoName: cpo.employeeName,
    originalDate: cpo.originalDate,
    personalDate: personalRow.workingDate,
  };
}

/**
 * Adds an optional approver to a dayoff request.
 * Inserts a row into employee_dayoff_approval with status ASKED.
 */
export async function addOptionalApprover(
  db: DbClient,
  requestId: number,
  approverLogin: string,
): Promise<{ approvalId: number; approverName: string }> {
  const approver = await db.queryOne<{ id: number; fullName: string }>(
    `SELECT id,
            CONCAT(russian_last_name, ' ', russian_first_name) AS "fullName"
     FROM ttt_vacation.employee
     WHERE login = $1`,
    [approverLogin],
  );
  const inserted = await db.queryOne<{ id: number }>(
    `INSERT INTO ttt_vacation.employee_dayoff_approval (dayoff, employee, status)
     VALUES ($1, $2, 'ASKED')
     RETURNING id`,
    [requestId, approver.id],
  );
  return { approvalId: inserted.id, approverName: approver.fullName };
}

/**
 * Finds a random enabled employee whose office's active calendar for the
 * current year matches the given calendar name. Also returns the expected
 * holiday count for that calendar (duration=0 entries in calendar_days).
 *
 * Active calendar = the one with the highest since_year <= current year
 * in office_calendar for that office.
 */
export async function findEmployeeByActiveCalendar(
  db: DbClient,
  calendarName: string,
): Promise<{ login: string; expectedCount: number }> {
  return db.queryOne<{ login: string; expectedCount: number }>(
    `SELECT e.login,
            (SELECT COUNT(*)::int FROM ttt_calendar.calendar_days cd
             WHERE cd.calendar_id = target_cal.calendar_id
             AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
            ) AS "expectedCount"
     FROM ttt_vacation.employee e
     JOIN (
       SELECT oc.office_id, oc.calendar_id
       FROM ttt_calendar.office_calendar oc
       JOIN ttt_calendar.calendar c ON c.id = oc.calendar_id
       WHERE c.name = $1
         AND oc.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
         AND NOT EXISTS (
           SELECT 1 FROM ttt_calendar.office_calendar oc2
           WHERE oc2.office_id = oc.office_id
             AND oc2.since_year > oc.since_year
             AND oc2.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
         )
     ) target_cal ON target_cal.office_id = e.office_id
     WHERE e.enabled = true
       AND e.manager IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
    [calendarName],
  );
}

/**
 * Finds an employee with at least 2 future free holidays (duration=0, no active transfer).
 * Returns the first two available holidays sorted by date.
 * Used for TC-DO-015/TC-DO-050 (need one holiday for setup transfer, another for dialog).
 */
export async function findEmployeeWithTwoFreeHolidays(
  db: DbClient,
): Promise<{ login: string; holiday1: string; holiday2: string }> {
  return db.queryOne<{ login: string; holiday1: string; holiday2: string }>(
    `WITH free AS (
       SELECT e.login, e.id AS eid, cd.calendar_date,
              ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY cd.calendar_date) AS rn
       FROM ttt_vacation.employee e
       JOIN ttt_calendar.office_calendar oc ON oc.office_id = e.office_id
       JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = oc.calendar_id
       WHERE e.enabled = true
         AND cd.duration = 0
         AND cd.calendar_date > CURRENT_DATE
         AND oc.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
         AND NOT EXISTS (
           SELECT 1 FROM ttt_calendar.office_calendar oc2
           WHERE oc2.office_id = oc.office_id
             AND oc2.since_year > oc.since_year
             AND oc2.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
         )
         AND NOT EXISTS (
           SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
           WHERE edr.employee = e.id
             AND edr.original_date = cd.calendar_date
             AND edr.status NOT IN ('DELETED','DELETED_FROM_CALENDAR','CANCELED')
         )
     )
     SELECT f1.login,
            f1.calendar_date::text AS holiday1,
            f2.calendar_date::text AS holiday2
     FROM free f1
     JOIN free f2 ON f1.eid = f2.eid AND f2.rn = 2
     WHERE f1.rn = 1
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Finds an employee whose office has a working weekend (Sat/Sun with duration > 0
 * in calendar_days) and a future free holiday. Working weekend must be reachable
 * from the holiday's reschedule dialog (same year, on or after the holiday).
 */
export async function findEmployeeWithWorkingWeekend(
  db: DbClient,
): Promise<{
  login: string;
  holidayDate: string;
  workingWeekendDate: string;
  workingWeekendDow: number;
}> {
  return db.queryOne<{
    login: string;
    holidayDate: string;
    workingWeekendDate: string;
    workingWeekendDow: number;
  }>(
    `SELECT e.login,
            cd_h.calendar_date::text AS "holidayDate",
            cd_ww.calendar_date::text AS "workingWeekendDate",
            EXTRACT(DOW FROM cd_ww.calendar_date)::int AS "workingWeekendDow"
     FROM ttt_vacation.employee e
     JOIN ttt_calendar.office_calendar oc ON oc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd_h ON cd_h.calendar_id = oc.calendar_id
     JOIN ttt_calendar.calendar_days cd_ww ON cd_ww.calendar_id = oc.calendar_id
     WHERE e.enabled = true
       AND cd_h.duration = 0
       AND cd_h.calendar_date > CURRENT_DATE
       AND cd_ww.duration > 0
       AND EXTRACT(DOW FROM cd_ww.calendar_date) IN (0, 6)
       AND cd_ww.calendar_date >= cd_h.calendar_date
       AND EXTRACT(YEAR FROM cd_ww.calendar_date) = EXTRACT(YEAR FROM cd_h.calendar_date)
       AND oc.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
       AND NOT EXISTS (
         SELECT 1 FROM ttt_calendar.office_calendar oc2
         WHERE oc2.office_id = oc.office_id
           AND oc2.since_year > oc.since_year
           AND oc2.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
       )
       AND NOT EXISTS (
         SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
         WHERE edr.employee = e.id
           AND edr.original_date = cd_h.calendar_date
           AND edr.status NOT IN ('DELETED','DELETED_FROM_CALENDAR','CANCELED')
       )
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Creates a transfer request for a specific employee and holiday via DB INSERT.
 * Returns the request ID and the chosen personalDate (a future working day).
 */
export async function createTransferForEmployee(
  db: DbClient,
  login: string,
  publicDate: string,
): Promise<{ requestId: number; personalDate: string }> {
  const emp = await db.queryOne<{ id: number; managerId: number | null }>(
    `SELECT e.id, e.manager AS "managerId"
     FROM ttt_vacation.employee e WHERE e.login = $1`,
    [login],
  );
  const personalDate = await findFutureWorkingDay(db, login, publicDate);
  const approverId = emp.managerId ?? emp.id;
  const inserted = await db.queryOne<{ id: number }>(
    `INSERT INTO ttt_vacation.employee_dayoff_request
       (employee, approver, original_date, personal_date, duration, status, creation_date)
     VALUES ($1, $2, $3::date, $4::date, 0, 'NEW', NOW())
     RETURNING id`,
    [emp.id, approverId, publicDate, personalDate],
  );
  await insertTimelineEvent(
    db, emp.id, approverId, inserted.id,
    "EMPLOYEE_DAY_OFF_CREATED", publicDate, personalDate,
  );
  return { requestId: inserted.id, personalDate };
}

/**
 * Deletes a transfer request and its related records (timeline, approvals).
 */
export async function deleteTransferRequest(
  db: DbClient,
  requestId: number,
): Promise<void> {
  await db.query(
    `DELETE FROM ttt_vacation.timeline WHERE day_off = $1`,
    [requestId],
  );
  await db.query(
    `DELETE FROM ttt_vacation.employee_dayoff_approval WHERE dayoff = $1`,
    [requestId],
  );
  await db.query(
    `DELETE FROM ttt_vacation.employee_dayoff_request WHERE id = $1`,
    [requestId],
  );
}

/**
 * Returns an employee with dayoff entries spanning multiple years.
 */
export async function findEmployeeWithMultiYearDayoffs(
  db: DbClient,
): Promise<EmployeeRow> {
  return db.queryOne<EmployeeRow>(
    `SELECT e.login
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee_dayoff ed ON ed.employee = e.id
     WHERE e.enabled = true
     GROUP BY e.login
     HAVING COUNT(DISTINCT EXTRACT(YEAR FROM ed.original_date)) >= 2
     ORDER BY random()
     LIMIT 1`,
  );
}
