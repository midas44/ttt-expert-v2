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

// ─── Phase C: TC-RPT-004..011 ───────────────────────────────

interface EmployeeWithMultipleTasksRow {
  login: string;
  task1_name: string;
  task2_name: string;
}

/**
 * Finds an employee with at least 2 pinned tasks (via fixed_task) on their
 * My Tasks grid, where the current week is in the open report period.
 */
export async function findEmployeeWithMultipleTasks(
  db: DbClient,
): Promise<{ login: string; task1Name: string; task2Name: string }> {
  const row = await db.queryOne<EmployeeWithMultipleTasksRow>(
    `SELECT e.login,
            (array_agg(
              CASE WHEN t.name LIKE p.name || ' / %'
                   THEN substring(t.name from length(p.name) + 4)
                   ELSE t.name END
              ORDER BY t.id
            ))[1] AS task1_name,
            (array_agg(
              CASE WHEN t.name LIKE p.name || ' / %'
                   THEN substring(t.name from length(p.name) + 4)
                   ELSE t.name END
              ORDER BY t.id
            ))[2] AS task2_name
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
       AND CURRENT_DATE >= op.start_date
     GROUP BY e.login
     HAVING COUNT(DISTINCT t.id) >= 2
     ORDER BY random()
     LIMIT 1`,
  );
  return {
    login: row.login,
    task1Name: row.task1_name,
    task2Name: row.task2_name,
  };
}

// ─── Phase C: TC-RPT-014,015 ──────────────────────────────────

interface ManagerAndEmployeeRow {
  manager_login: string;
  employee_login: string;
}

/** Finds a manager (PM/ADMIN) and a random employee with pinned tasks. */
export async function findManagerAndEmployee(
  db: DbClient,
): Promise<{ managerLogin: string; employeeLogin: string }> {
  const row = await db.queryOne<ManagerAndEmployeeRow>(
    `SELECT m.login AS manager_login, e.login AS employee_login
     FROM ttt_backend.employee m
     JOIN ttt_backend.employee_global_roles mr ON mr.employee = m.id
     JOIN ttt_backend.employee e ON e.enabled = true AND e.id != m.id
     WHERE m.enabled = true
       AND mr.role_name IN ('ROLE_PROJECT_MANAGER', 'ROLE_ADMIN')
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND e.login != 'pvaynmaster'
       AND EXISTS (
         SELECT 1 FROM ttt_backend.fixed_task ft
         JOIN ttt_backend.task t ON ft.task = t.id
         JOIN ttt_backend.project p ON t.project = p.id
         WHERE ft.employee = e.id AND p.status = 'ACTIVE'
       )
     ORDER BY random()
     LIMIT 1`,
  );
  return { managerLogin: row.manager_login, employeeLogin: row.employee_login };
}

interface ContractorAndAdminRow {
  contractor_login: string;
  admin_login: string;
}

/** Finds a contractor employee and an admin user. */
export async function findContractorAndAdmin(
  db: DbClient,
): Promise<{ contractorLogin: string; adminLogin: string }> {
  const row = await db.queryOne<ContractorAndAdminRow>(
    `SELECT c.login AS contractor_login,
            (SELECT a.login FROM ttt_backend.employee a
             JOIN ttt_backend.employee_global_roles ar ON ar.employee = a.id
             WHERE a.enabled = true AND ar.role_name = 'ROLE_ADMIN'
             ORDER BY random() LIMIT 1) AS admin_login
     FROM ttt_backend.employee c
     WHERE c.enabled = true
       AND c.is_contractor = true
     ORDER BY random()
     LIMIT 1`,
  );
  return { contractorLogin: row.contractor_login, adminLogin: row.admin_login };
}

// ─── Phase C: TC-RPT-016..020 (Confirmation suite) ──────────

interface ConfirmationSetupRow {
  manager_login: string;
  employee_login: string;
  employee_name: string;
  project_name: string;
  task_name: string;
  task_id: number;
}

/**
 * Finds a manager (PM/ADMIN) and an employee on the same project with a task,
 * where the target date is within both REPORT and APPROVE open periods
 * and no report exists for the employee+task+date.
 *
 * Used by TC-RPT-016..019 (confirmation page tests).
 */
export async function findManagerProjectEmployeeForConfirmation(
  db: DbClient,
  targetDate: string,
): Promise<{
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  projectName: string;
  taskName: string;
  taskId: number;
}> {
  const row = await db.queryOne<ConfirmationSetupRow>(
    `SELECT
       m.login  AS manager_login,
       e.login  AS employee_login,
       e.latin_first_name || ' ' || e.latin_last_name AS employee_name,
       p.name   AS project_name,
       t.name   AS task_name,
       t.id     AS task_id
     FROM ttt_backend.employee m
     JOIN ttt_backend.employee_global_roles mr ON mr.employee = m.id
     JOIN ttt_backend.project_member mpm ON mpm.employee = m.id
     JOIN ttt_backend.project p   ON p.id = mpm.project
     JOIN ttt_backend.task t      ON t.project = p.id
     JOIN ttt_backend.project_member epm ON epm.project = p.id
     JOIN ttt_backend.employee e  ON epm.employee = e.id
     JOIN ttt_backend.fixed_task ft ON ft.employee = e.id AND ft.task = t.id
     JOIN ttt_backend.office_period rp
       ON e.salary_office = rp.office AND rp.type = 'REPORT'
     JOIN ttt_backend.office_period ap
       ON e.salary_office = ap.office AND ap.type = 'APPROVE'
     WHERE m.enabled = true
       AND e.enabled = true
       AND m.id != e.id
       AND mr.role_name IN ('ROLE_PROJECT_MANAGER', 'ROLE_ADMIN')
       AND p.status = 'ACTIVE'
       AND upper(COALESCE(mpm.role, '')) IN ('PM', 'DM', 'PO')
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND e.login != 'pvaynmaster'
       AND $1::date >= rp.start_date
       AND $1::date >= ap.start_date
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_report tr
         WHERE tr.executor = e.id
           AND tr.task = t.id
           AND tr.report_date = $1::date
       )
     ORDER BY random()
     LIMIT 1`,
    [targetDate],
  );
  return {
    managerLogin: row.manager_login,
    employeeLogin: row.employee_login,
    employeeName: row.employee_name,
    projectName: row.project_name,
    taskName: row.task_name,
    taskId: row.task_id,
  };
}

/**
 * Strips the "ProjectName / " prefix from a task name.
 * The My Tasks page with "Group by project" enabled displays tasks
 * without the project prefix (e.g., "QA: Android Host" instead of
 * "WiseMoGuest / QA: Android Host").
 */
export function stripProjectPrefix(
  taskName: string,
  projectName: string,
): string {
  const prefix = `${projectName} / `;
  return taskName.startsWith(prefix)
    ? taskName.slice(prefix.length)
    : taskName;
}

/**
 * Same as findManagerProjectEmployeeForConfirmation but ensures no reports
 * exist on TWO dates (for bulk approve test TC-RPT-020).
 */
export async function findManagerProjectEmployeeForBulkApprove(
  db: DbClient,
  targetDate1: string,
  targetDate2: string,
): Promise<{
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  projectName: string;
  taskName: string;
  taskId: number;
}> {
  const row = await db.queryOne<ConfirmationSetupRow>(
    `SELECT
       m.login  AS manager_login,
       e.login  AS employee_login,
       e.latin_first_name || ' ' || e.latin_last_name AS employee_name,
       p.name   AS project_name,
       t.name   AS task_name,
       t.id     AS task_id
     FROM ttt_backend.employee m
     JOIN ttt_backend.employee_global_roles mr ON mr.employee = m.id
     JOIN ttt_backend.project_member mpm ON mpm.employee = m.id
     JOIN ttt_backend.project p   ON p.id = mpm.project
     JOIN ttt_backend.task t      ON t.project = p.id
     JOIN ttt_backend.project_member epm ON epm.project = p.id
     JOIN ttt_backend.employee e  ON epm.employee = e.id
     JOIN ttt_backend.fixed_task ft ON ft.employee = e.id AND ft.task = t.id
     JOIN ttt_backend.office_period rp
       ON e.salary_office = rp.office AND rp.type = 'REPORT'
     JOIN ttt_backend.office_period ap
       ON e.salary_office = ap.office AND ap.type = 'APPROVE'
     WHERE m.enabled = true
       AND e.enabled = true
       AND m.id != e.id
       AND mr.role_name IN ('ROLE_PROJECT_MANAGER', 'ROLE_ADMIN')
       AND p.status = 'ACTIVE'
       AND upper(COALESCE(mpm.role, '')) IN ('PM', 'DM', 'PO')
       AND (e.is_contractor IS NULL OR e.is_contractor = false)
       AND e.login != 'pvaynmaster'
       AND $1::date >= rp.start_date
       AND $1::date >= ap.start_date
       AND $2::date >= rp.start_date
       AND $2::date >= ap.start_date
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_report tr
         WHERE tr.executor = e.id
           AND tr.task = t.id
           AND tr.report_date IN ($1::date, $2::date)
       )
     ORDER BY random()
     LIMIT 1`,
    [targetDate1, targetDate2],
  );
  return {
    managerLogin: row.manager_login,
    employeeLogin: row.employee_login,
    employeeName: row.employee_name,
    projectName: row.project_name,
    taskName: row.task_name,
    taskId: row.task_id,
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
