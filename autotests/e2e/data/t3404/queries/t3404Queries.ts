import { DbClient } from "../../../config/db/dbClient";

/**
 * All queries use calendar_days (the production calendar) as the source of truth
 * for dates shown in the Day Off tab. The employee_dayoff table is a synced copy
 * that can diverge. When a transfer request exists (employee_dayoff_request), the
 * UI shows the transferred date instead of the original — so we exclude dates with
 * active transfer requests to ensure the queried date matches what the UI displays.
 *
 * Shared CTE: latest applicable calendar per office.
 * office_calendar has since_year — we pick the calendar with the highest since_year
 * that is <= current year.
 */
const LATEST_CAL = `
  latest_cal AS (
    SELECT oc.office_id, oc.calendar_id
    FROM ttt_calendar.office_calendar oc
    WHERE oc.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
      AND NOT EXISTS (
        SELECT 1 FROM ttt_calendar.office_calendar oc2
        WHERE oc2.office_id = oc.office_id
          AND oc2.since_year > oc.since_year
          AND oc2.since_year <= EXTRACT(YEAR FROM CURRENT_DATE)
      )
  )`;

/** Shared condition: no active transfer request for this employee+date. */
const NO_ACTIVE_TRANSFER = `
      AND NOT EXISTS (
        SELECT 1 FROM ttt_vacation.employee_dayoff_request edr
        WHERE edr.employee = e.id
          AND edr.original_date = cd.calendar_date
          AND edr.status NOT IN ('DELETED', 'DELETED_FROM_CALENDAR', 'CANCELED')
      )`;

/**
 * Find an employee with a production calendar holiday (duration=0) in the OPEN
 * approve period that is BEFORE today. Core #3404 scenario: past day-offs in
 * open months should now show the edit icon.
 */
export async function findPastDayoffInOpenPeriod(
  db: DbClient,
): Promise<{ login: string; date: string }> {
  return db.queryOne<{ login: string; date: string }>(
    `WITH ${LATEST_CAL}
     SELECT e.login, cd.calendar_date::text AS date
     FROM ttt_vacation.employee e
     JOIN latest_cal lc ON lc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
     JOIN ttt_backend.office_period op
       ON op.office = e.office_id AND op.type = 'APPROVE'
     WHERE e.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date < CURRENT_DATE
       AND cd.calendar_date >= op.start_date
       AND EXTRACT(DOW FROM cd.calendar_date) NOT IN (0, 6)
       AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ${NO_ACTIVE_TRANSFER}
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Find an employee with a production calendar holiday in a CLOSED approve period
 * (date before the approve period start). These should NOT have edit icons.
 */
export async function findDayoffInClosedPeriod(
  db: DbClient,
): Promise<{ login: string; date: string }> {
  return db.queryOne<{ login: string; date: string }>(
    `WITH ${LATEST_CAL}
     SELECT e.login, cd.calendar_date::text AS date
     FROM ttt_vacation.employee e
     JOIN latest_cal lc ON lc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
     JOIN ttt_backend.office_period op
       ON op.office = e.office_id AND op.type = 'APPROVE'
     WHERE e.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date < op.start_date
       AND EXTRACT(DOW FROM cd.calendar_date) NOT IN (0, 6)
       AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ${NO_ACTIVE_TRANSFER}
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Find an employee with a FUTURE production calendar holiday in the open period.
 * Baseline: future day-offs should have edit icon (pre-#3404 behavior).
 */
export async function findFutureDayoffInOpenPeriod(
  db: DbClient,
): Promise<{ login: string; date: string }> {
  return db.queryOne<{ login: string; date: string }>(
    `WITH ${LATEST_CAL}
     SELECT e.login, cd.calendar_date::text AS date
     FROM ttt_vacation.employee e
     JOIN latest_cal lc ON lc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
     WHERE e.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date > CURRENT_DATE
       AND EXTRACT(DOW FROM cd.calendar_date) NOT IN (0, 6)
       AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ${NO_ACTIVE_TRANSFER}
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Find a holiday exactly ON or closest to the approve period start date.
 * For TC-T3404-007 boundary test. Tests BUG-T3404-1: code uses > instead of >=.
 */
export async function findDayOffOnOrNearPeriodStart(
  db: DbClient,
): Promise<{
  login: string;
  date: string;
  approve_start: string;
  is_exact: boolean;
}> {
  // Try exact match first
  const exact = await db.queryOneOrNull<{
    login: string;
    date: string;
    approve_start: string;
  }>(
    `WITH ${LATEST_CAL}
     SELECT e.login,
            cd.calendar_date::text AS date,
            op.start_date::text AS approve_start
     FROM ttt_vacation.employee e
     JOIN latest_cal lc ON lc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
     JOIN ttt_backend.office_period op
       ON op.office = e.office_id AND op.type = 'APPROVE'
     WHERE e.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date = op.start_date
       AND EXTRACT(DOW FROM cd.calendar_date) NOT IN (0, 6)
       ${NO_ACTIVE_TRANSFER}
     ORDER BY random()
     LIMIT 1`,
  );
  if (exact) return { ...exact, is_exact: true };

  // Fallback: first holiday in the approve period month
  return db.queryOne<{
    login: string;
    date: string;
    approve_start: string;
    is_exact: boolean;
  }>(
    `WITH ${LATEST_CAL}
     SELECT e.login,
            cd.calendar_date::text AS date,
            op.start_date::text AS approve_start,
            false AS is_exact
     FROM ttt_vacation.employee e
     JOIN latest_cal lc ON lc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
     JOIN ttt_backend.office_period op
       ON op.office = e.office_id AND op.type = 'APPROVE'
     WHERE e.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date >= op.start_date
       AND cd.calendar_date < (op.start_date + INTERVAL '1 month')
       AND EXTRACT(DOW FROM cd.calendar_date) NOT IN (0, 6)
       AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ${NO_ACTIVE_TRANSFER}
     ORDER BY cd.calendar_date ASC
     LIMIT 1`,
  );
}

/**
 * Find a FUTURE mid-month day-off (day >= 5) in the open period.
 * For TC-T3404-019: tests that minDate = originalDate for future holidays,
 * so earlier working days in the same month are disabled.
 */
export async function findFutureMidMonthDayoff(
  db: DbClient,
): Promise<{ login: string; date: string }> {
  return db.queryOne<{ login: string; date: string }>(
    `WITH ${LATEST_CAL}
     SELECT e.login, cd.calendar_date::text AS date
     FROM ttt_vacation.employee e
     JOIN latest_cal lc ON lc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
     WHERE e.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date > CURRENT_DATE
       AND EXTRACT(DAY FROM cd.calendar_date) >= 5
       AND EXTRACT(DOW FROM cd.calendar_date) NOT IN (0, 6)
       AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ${NO_ACTIVE_TRANSFER}
     ORDER BY cd.calendar_date ASC
     LIMIT 1`,
  );
}

/**
 * Find a past day-off in open period with the employee's manager login.
 * For TC-T3404-020: E2E reschedule + approval flow.
 */
export async function findPastDayoffWithManager(
  db: DbClient,
): Promise<{ login: string; date: string; manager_login: string }> {
  return db.queryOne<{ login: string; date: string; manager_login: string }>(
    `WITH ${LATEST_CAL}
     SELECT e.login, cd.calendar_date::text AS date, m.login AS manager_login
     FROM ttt_vacation.employee e
     JOIN ttt_vacation.employee m ON m.id = e.manager
     JOIN latest_cal lc ON lc.office_id = e.office_id
     JOIN ttt_calendar.calendar_days cd ON cd.calendar_id = lc.calendar_id
     JOIN ttt_backend.office_period op
       ON op.office = e.office_id AND op.type = 'APPROVE'
     WHERE e.enabled = true
       AND m.enabled = true
       AND cd.duration = 0
       AND cd.calendar_date < CURRENT_DATE
       AND cd.calendar_date >= op.start_date
       AND EXTRACT(DOW FROM cd.calendar_date) NOT IN (0, 6)
       AND EXTRACT(YEAR FROM cd.calendar_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       ${NO_ACTIVE_TRANSFER}
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Get the approve period start date (excludes outlier office id=9 with 2020 date).
 */
export async function getApprovePeriodStart(
  db: DbClient,
): Promise<string> {
  const row = await db.queryOne<{ start_date: string }>(
    `SELECT MIN(op.start_date)::text AS start_date
     FROM ttt_backend.office_period op
     WHERE op.type = 'APPROVE'
       AND op.start_date >= '2025-01-01'`,
  );
  return row.start_date;
}
