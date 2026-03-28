import { DbClient } from "../../../config/db/dbClient";

// ─── Existing ────────────────────────────────────────────────

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

// ─── Phase C: TC-RPT-001..005 ───────────────────────────────

interface EmployeeForReportingRow {
  login: string;
  task_name: string;
  task_id: number;
}

/**
 * Finds an employee with a pinned task (via fixed_task table) on their
 * My Tasks grid, where the target date is in the open report period
 * and has no existing report for that task+date.
 *
 * Returns the task's UI display name (project prefix stripped —
 * the My Tasks page removes the project name prefix from task names
 * when "Group by project" is enabled).
 */
export async function findEmployeeForReporting(
  db: DbClient,
  targetDate: string,
): Promise<{ login: string; taskName: string; taskId: number }> {
  const row = await db.queryOne<EmployeeForReportingRow>(
    `SELECT e.login,
            CASE
              WHEN t.name LIKE p.name || ' / %'
              THEN substring(t.name from length(p.name) + 4)
              ELSE t.name
            END AS task_name,
            t.id AS task_id
     FROM ttt_backend.employee e
     JOIN ttt_backend.fixed_task ft ON ft.employee = e.id
     JOIN ttt_backend.task t ON ft.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     JOIN ttt_backend.office_period op
       ON e.salary_office = op.office AND op.type = 'REPORT'
     WHERE e.enabled = true
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND e.login != 'pvaynmaster'
       AND p.status = 'ACTIVE'
       AND $1::date >= op.start_date
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_report tr2
         WHERE tr2.executor = e.id
           AND tr2.task = t.id
           AND tr2.report_date = $1::date
       )
     ORDER BY random()
     LIMIT 1`,
    [targetDate],
  );
  return { login: row.login, taskName: row.task_name, taskId: row.task_id };
}

interface ClosedPeriodRow {
  login: string;
  period_start: string;
  task_name: string;
}

/**
 * Finds an employee whose report period start date leaves some past
 * weeks closed. Returns the period start so the test can navigate
 * to a week before it.
 */
export async function findEmployeeWithClosedPeriod(
  db: DbClient,
): Promise<{ login: string; periodStart: string; taskName: string }> {
  const row = await db.queryOne<ClosedPeriodRow>(
    `SELECT e.login, op.start_date::text AS period_start, t.name AS task_name
     FROM ttt_backend.employee e
     JOIN ttt_backend.office_period op
       ON e.salary_office = op.office AND op.type = 'REPORT'
     JOIN ttt_backend.task_report tr ON tr.executor = e.id
     JOIN ttt_backend.task t ON tr.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     WHERE e.enabled = true
       AND e.login != 'pvaynmaster'
       AND p.status = 'ACTIVE'
       AND op.start_date > (CURRENT_DATE - INTERVAL '60 days')
       AND tr.report_date >= (CURRENT_DATE - INTERVAL '90 days')
     ORDER BY random()
     LIMIT 1`,
  );
  return {
    login: row.login,
    periodStart: row.period_start,
    taskName: row.task_name,
  };
}

interface TaskToAddRow {
  login: string;
  task_name: string;
  project_name: string;
}

/**
 * Finds an employee + task where the employee belongs to the task's project
 * but has NOT reported on that task recently — so the task won't be on
 * their grid and can be added via "Add a task".
 */
export async function findTaskToAdd(
  db: DbClient,
): Promise<{ login: string; taskName: string; projectName: string }> {
  const row = await db.queryOne<TaskToAddRow>(
    `SELECT e.login,
            CASE
              WHEN t.name LIKE p.name || ' / %'
              THEN substring(t.name from length(p.name) + 4)
              ELSE t.name
            END AS task_name,
            p.name AS project_name
     FROM ttt_backend.employee e
     JOIN ttt_backend.project_member pm ON pm.employee = e.id
     JOIN ttt_backend.project p ON p.id = pm.project
     JOIN ttt_backend.task t ON t.project = p.id
     LEFT JOIN ttt_backend.fixed_task ft
       ON ft.employee = e.id AND ft.task = t.id
     WHERE e.enabled = true
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND e.login != 'pvaynmaster'
       AND p.status = 'ACTIVE'
       AND length(t.name) >= 3
       AND ft.task IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_report tr
         WHERE tr.executor = e.id
           AND tr.task = t.id
           AND tr.report_date >= (CURRENT_DATE - INTERVAL '90 days')
       )
     ORDER BY random()
     LIMIT 1`,
  );
  return {
    login: row.login,
    taskName: row.task_name,
    projectName: row.project_name,
  };
}

/**
 * Returns a weekday in the current week as "dd.mm" and "yyyy-mm-dd" formats.
 * @param dayOffset 0=Mon, 1=Tue, 2=Wed(default), 3=Thu, 4=Fri
 */
export function getCurrentWeekday(dayOffset = 2): {
  dateLabel: string;
  dateIso: string;
} {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));

  const d = new Date(monday);
  d.setDate(monday.getDate() + dayOffset);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return { dateLabel: `${dd}.${mm}`, dateIso: `${yyyy}-${mm}-${dd}` };
}
