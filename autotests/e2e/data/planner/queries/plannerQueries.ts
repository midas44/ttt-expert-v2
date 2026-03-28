import { DbClient } from "../../../config/db/dbClient";

interface EnabledEmployeeRow {
  login: string;
}

/** Finds a random enabled employee for basic planner access tests. */
export async function findEnabledEmployee(
  db: DbClient,
): Promise<EnabledEmployeeRow> {
  return db.queryOne<EnabledEmployeeRow>(
    `SELECT e.login
     FROM ttt_backend.employee e
     WHERE e.enabled = true
       AND e.login IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
}

interface ProjectManagerRow {
  login: string;
  project_id: number;
  project_name: string;
}

/** Finds a random PM who manages at least one ACTIVE project. */
export async function findProjectManager(
  db: DbClient,
): Promise<ProjectManagerRow> {
  return db.queryOne<ProjectManagerRow>(
    `SELECT e.login,
            p.id AS project_id,
            p.name AS project_name
     FROM ttt_backend.project p
     JOIN ttt_backend.employee e ON p.manager = e.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND e.login IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
}

interface MultiRoleEmployeeRow {
  login: string;
  pm_project_name: string;
  member_project_name: string;
}

interface EmployeeWithAssignmentRow {
  login: string;
  project_name: string;
}

/** Finds an employee with at least one open task assignment in an active project. */
export async function findEmployeeWithAssignment(
  db: DbClient,
): Promise<EmployeeWithAssignmentRow> {
  return db.queryOne<EmployeeWithAssignmentRow>(
    `SELECT e.login, p.name AS project_name
     FROM ttt_backend.employee e
     JOIN ttt_backend.task_assignment ta ON ta.assignee = e.id
     JOIN ttt_backend.task t ON ta.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND e.login IS NOT NULL
       AND ta.closed = false
     ORDER BY random()
     LIMIT 1`,
  );
}

interface EmployeeWithWeekdayAssignmentRow {
  login: string;
  project_name: string;
  days_back: number;
}

/**
 * Finds an employee with a task_assignment on a recent weekday (Mon-Fri).
 * Returns daysBack so the test can navigate to that specific date.
 * Having an existing DB assignment ensures the row is NOT readonly
 * and the search bar renders instead of "Open for editing".
 */
export async function findEmployeeWithWeekdayAssignment(
  db: DbClient,
): Promise<EmployeeWithWeekdayAssignmentRow> {
  return db.queryOne<EmployeeWithWeekdayAssignmentRow>(
    `SELECT e.login,
            p.name AS project_name,
            (CURRENT_DATE - ta.date) AS days_back
     FROM ttt_backend.employee e
     JOIN ttt_backend.task_assignment ta ON ta.assignee = e.id
     JOIN ttt_backend.task t ON ta.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND e.login IS NOT NULL
       AND ta.closed = false
       AND ta.date >= CURRENT_DATE - 7
       AND ta.date <= CURRENT_DATE
       AND EXTRACT(DOW FROM ta.date) BETWEEN 1 AND 5
     ORDER BY ta.date DESC, random()
     LIMIT 1`,
  );
}

interface EmployeeWithAvailableTaskRow {
  login: string;
  project_name: string;
  task_name: string;
  days_back: number;
}

/**
 * Finds an employee with a weekday assignment AND another task in the same project
 * that they don't yet have an assignment for on that date — suitable for add-task tests.
 */
export async function findEmployeeWithAvailableTask(
  db: DbClient,
): Promise<EmployeeWithAvailableTaskRow> {
  return db.queryOne<EmployeeWithAvailableTaskRow>(
    `WITH emp_with_assignment AS (
       SELECT e.id AS emp_id, e.login, p.id AS project_id, p.name AS project_name,
              ta.date AS assignment_date,
              (CURRENT_DATE - ta.date)::int AS days_back
       FROM ttt_backend.employee e
       JOIN ttt_backend.task_assignment ta ON ta.assignee = e.id
       JOIN ttt_backend.task t ON ta.task = t.id
       JOIN ttt_backend.project p ON t.project = p.id
       WHERE e.enabled = true
         AND p.status = 'ACTIVE'
         AND ta.closed = false
         AND ta.date >= CURRENT_DATE - 7
         AND ta.date <= CURRENT_DATE
         AND EXTRACT(DOW FROM ta.date) BETWEEN 1 AND 5
       ORDER BY ta.date DESC, random()
       LIMIT 1
     )
     SELECT ewa.login, ewa.project_name, t.name AS task_name, ewa.days_back
     FROM emp_with_assignment ewa
     JOIN ttt_backend.task t ON t.project = ewa.project_id
     WHERE NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_assignment ta3
         WHERE ta3.assignee = ewa.emp_id
           AND ta3.task = t.id
           AND ta3.date = ewa.assignment_date
       )
     ORDER BY random()
     LIMIT 1`,
  );
}

interface EmployeeWithTaskDetailsRow {
  login: string;
  project_name: string;
  task_name: string;
  days_back: number;
}

/** Finds an employee with a task_assignment on a recent weekday, including task name for row identification. */
export async function findEmployeeWithTaskDetails(
  db: DbClient,
): Promise<EmployeeWithTaskDetailsRow> {
  return db.queryOne<EmployeeWithTaskDetailsRow>(
    `SELECT e.login, p.name AS project_name, t.name AS task_name,
            (CURRENT_DATE - ta.date)::int AS days_back
     FROM ttt_backend.employee e
     JOIN ttt_backend.task_assignment ta ON ta.assignee = e.id
     JOIN ttt_backend.task t ON ta.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND ta.closed = false
       AND ta.date >= CURRENT_DATE - 7
       AND ta.date <= CURRENT_DATE
       AND EXTRACT(DOW FROM ta.date) BETWEEN 1 AND 5
     ORDER BY ta.date DESC, random()
     LIMIT 1`,
  );
}

interface ProjectManagerWithEmployeeRow {
  login: string;
  project_id: number;
  project_name: string;
  employee_login: string;
  employee_name: string;
  days_back: number;
}

/**
 * Finds a PM whose project has at least one different employee member
 * with task assignments on a recent weekday. Used for Projects tab tests.
 */
export async function findProjectManagerWithEmployee(
  db: DbClient,
): Promise<ProjectManagerWithEmployeeRow> {
  return db.queryOne<ProjectManagerWithEmployeeRow>(
    `SELECT e_pm.login,
            p.id AS project_id,
            p.name AS project_name,
            e_member.login AS employee_login,
            e_member.name AS employee_name,
            (CURRENT_DATE - ta.date)::int AS days_back
     FROM ttt_backend.project p
     JOIN ttt_backend.employee e_pm ON p.manager = e_pm.id
     JOIN ttt_backend.project_member pm ON pm.project = p.id
     JOIN ttt_backend.employee e_member ON pm.employee = e_member.id
     JOIN ttt_backend.task_assignment ta ON ta.assignee = e_member.id
     JOIN ttt_backend.task t ON ta.task = t.id AND t.project = p.id
     WHERE e_pm.enabled = true
       AND e_member.enabled = true
       AND p.status = 'ACTIVE'
       AND ta.closed = false
       AND ta.date >= CURRENT_DATE - 7
       AND ta.date <= CURRENT_DATE
       AND EXTRACT(DOW FROM ta.date) BETWEEN 1 AND 5
       AND e_pm.id != e_member.id
     ORDER BY random()
     LIMIT 1`,
  );
}

interface ProjectWithTrackerInfoRow {
  login: string;
  project_name: string;
}

/**
 * Finds a PM whose project has tasks with non-empty ticket_info.
 * Used for color coding and tracker info display tests.
 */
export async function findProjectWithTrackerInfo(
  db: DbClient,
): Promise<ProjectWithTrackerInfoRow> {
  return db.queryOne<ProjectWithTrackerInfoRow>(
    `SELECT e.login, p.name AS project_name
     FROM ttt_backend.project p
     JOIN ttt_backend.employee e ON p.manager = e.id
     JOIN ttt_backend.task t ON t.project = p.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND e.login IS NOT NULL
       AND t.ticket_info IS NOT NULL
       AND t.ticket_info != ''
     ORDER BY random()
     LIMIT 1`,
  );
}

interface EmployeeWithDeletableAssignmentRow {
  login: string;
  project_name: string;
  task_name: string;
  days_back: number;
}

/**
 * Finds an employee with a task_assignment on a recent weekday that has NO reported hours,
 * so the delete button is enabled. Used for delete assignment tests.
 */
export async function findEmployeeWithDeletableAssignment(
  db: DbClient,
): Promise<EmployeeWithDeletableAssignmentRow> {
  return db.queryOne<EmployeeWithDeletableAssignmentRow>(
    `SELECT e.login, p.name AS project_name, t.name AS task_name,
            (CURRENT_DATE - ta.date)::int AS days_back
     FROM ttt_backend.employee e
     JOIN ttt_backend.task_assignment ta ON ta.assignee = e.id
     JOIN ttt_backend.task t ON ta.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     LEFT JOIN ttt_backend.task_report tr
       ON tr.task = ta.task
       AND tr.executor = ta.assignee
       AND tr.report_date = ta.date
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND ta.closed = false
       AND ta.date >= CURRENT_DATE - 7
       AND ta.date <= CURRENT_DATE
       AND EXTRACT(DOW FROM ta.date) BETWEEN 1 AND 5
       AND (tr.id IS NULL OR tr.actual_efforts IS NULL OR tr.actual_efforts = 0)
     ORDER BY ta.date DESC, random()
     LIMIT 1`,
  );
}

interface MultiProjectEmployeeRow {
  login: string;
}

/** Finds an employee with open task assignments in at least 2 different active projects. */
export async function findEmployeeWithMultipleProjectAssignments(
  db: DbClient,
): Promise<MultiProjectEmployeeRow> {
  return db.queryOne<MultiProjectEmployeeRow>(
    `SELECT e.login
     FROM ttt_backend.employee e
     JOIN ttt_backend.task_assignment ta ON ta.assignee = e.id
     JOIN ttt_backend.task t ON ta.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND e.login IS NOT NULL
       AND ta.closed = false
     GROUP BY e.id, e.login
     HAVING COUNT(DISTINCT p.id) >= 2
     ORDER BY random()
     LIMIT 1`,
  );
}

interface EmptyDateEmployeeRow {
  login: string;
  days_back: number;
}

/**
 * Finds an employee and a recent weekend date (within 7 days)
 * where they have no task assignments — for empty state testing.
 */
export async function findEmployeeWithEmptyWeekend(
  db: DbClient,
): Promise<EmptyDateEmployeeRow> {
  return db.queryOne<EmptyDateEmployeeRow>(
    `SELECT e.login,
            (CURRENT_DATE - d.target_date) AS days_back
     FROM ttt_backend.employee e
     CROSS JOIN (
       SELECT CURRENT_DATE - i AS target_date
       FROM generate_series(0, 13) i
       WHERE EXTRACT(DOW FROM CURRENT_DATE - i) IN (0, 6)
     ) d
     WHERE e.enabled = true
       AND e.login IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_assignment ta
         WHERE ta.assignee = e.id
           AND ta.date = d.target_date
       )
     ORDER BY d.target_date DESC, random()
     LIMIT 1`,
  );
}

interface PMWithDndReadyEmployeeRow {
  login: string;
  project_id: number;
  project_name: string;
  employee_login: string;
  employee_name: string;
  days_back: number;
}

/**
 * Finds a PM whose project has an employee with 3+ open task assignments
 * on the same recent weekday — suitable for DnD reorder tests.
 */
export async function findPMWithDndReadyEmployee(
  db: DbClient,
): Promise<PMWithDndReadyEmployeeRow> {
  return db.queryOne<PMWithDndReadyEmployeeRow>(
    `SELECT e_pm.login,
            p.id AS project_id,
            p.name AS project_name,
            e_member.login AS employee_login,
            e_member.name AS employee_name,
            (CURRENT_DATE - ta.date)::int AS days_back
     FROM ttt_backend.project p
     JOIN ttt_backend.employee e_pm ON p.manager = e_pm.id
     JOIN ttt_backend.project_member pm ON pm.project = p.id
     JOIN ttt_backend.employee e_member ON pm.employee = e_member.id
     JOIN ttt_backend.task_assignment ta ON ta.assignee = e_member.id
     JOIN ttt_backend.task t ON ta.task = t.id AND t.project = p.id
     WHERE e_pm.enabled = true
       AND e_member.enabled = true
       AND p.status = 'ACTIVE'
       AND ta.closed = false
       AND ta.date >= CURRENT_DATE - 14
       AND ta.date <= CURRENT_DATE
       AND EXTRACT(DOW FROM ta.date) BETWEEN 1 AND 5
       AND e_pm.id != e_member.id
     GROUP BY e_pm.login, p.id, p.name, e_member.login, e_member.name, ta.date
     HAVING COUNT(DISTINCT ta.id) >= 3
     ORDER BY random()
     LIMIT 1`,
  );
}

interface PMWithTwoEmployeesRow {
  login: string;
  project_id: number;
  project_name: string;
  employee_a_name: string;
  employee_b_name: string;
  days_back: number;
}

/**
 * Finds a PM whose project has 2 different employees each with 2+ open task assignments
 * on the same recent weekday — for DnD order preservation across employee editing toggle.
 */
export async function findPMWithTwoEmployees(
  db: DbClient,
): Promise<PMWithTwoEmployeesRow> {
  return db.queryOne<PMWithTwoEmployeesRow>(
    `WITH emp_counts AS (
       SELECT e_pm.id AS pm_id, e_pm.login AS pm_login,
              p.id AS project_id, p.name AS project_name,
              e_member.name AS member_name,
              ta.date AS assignment_date,
              (CURRENT_DATE - ta.date)::int AS days_back,
              COUNT(DISTINCT ta.id) AS cnt
       FROM ttt_backend.project p
       JOIN ttt_backend.employee e_pm ON p.manager = e_pm.id
       JOIN ttt_backend.project_member pm ON pm.project = p.id
       JOIN ttt_backend.employee e_member ON pm.employee = e_member.id
       JOIN ttt_backend.task_assignment ta ON ta.assignee = e_member.id
       JOIN ttt_backend.task t ON ta.task = t.id AND t.project = p.id
       WHERE e_pm.enabled = true
         AND e_member.enabled = true
         AND p.status = 'ACTIVE'
         AND ta.closed = false
         AND ta.date >= CURRENT_DATE - 14
         AND ta.date <= CURRENT_DATE
         AND EXTRACT(DOW FROM ta.date) BETWEEN 1 AND 5
         AND e_pm.id != e_member.id
       GROUP BY e_pm.id, e_pm.login, p.id, p.name, e_member.name, ta.date
       HAVING COUNT(DISTINCT ta.id) >= 2
     )
     SELECT a.pm_login AS login,
            a.project_id,
            a.project_name,
            a.member_name AS employee_a_name,
            b.member_name AS employee_b_name,
            a.days_back
     FROM emp_counts a
     JOIN emp_counts b ON a.pm_id = b.pm_id
       AND a.project_id = b.project_id
       AND a.assignment_date = b.assignment_date
       AND a.member_name < b.member_name
     WHERE a.cnt >= 3
     ORDER BY random()
     LIMIT 1`,
  );
}

/**
 * Finds an employee who is PM on one project and a plain member on another.
 * Used for role filter tests.
 */
export async function findEmployeeWithMultipleRoles(
  db: DbClient,
): Promise<MultiRoleEmployeeRow> {
  return db.queryOne<MultiRoleEmployeeRow>(
    `WITH pm_projects AS (
       SELECT e.id AS emp_id, e.login, p.name AS pm_project_name
       FROM ttt_backend.employee e
       JOIN ttt_backend.project p ON p.manager = e.id
       WHERE e.enabled = true
         AND p.status = 'ACTIVE'
         AND e.login IS NOT NULL
     ),
     member_projects AS (
       SELECT pm2.employee, p.name AS member_project_name
       FROM ttt_backend.project_member pm2
       JOIN ttt_backend.project p ON pm2.project = p.id
       WHERE p.status = 'ACTIVE'
     )
     SELECT pm.login,
            pm.pm_project_name,
            mp.member_project_name
     FROM pm_projects pm
     JOIN member_projects mp ON mp.employee = pm.emp_id
       AND mp.member_project_name != pm.pm_project_name
     ORDER BY random()
     LIMIT 1`,
  );
}
