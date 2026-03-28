import { DbClient } from "../../../config/db/dbClient";

interface ProjectWithManagerRow {
  project_id: number;
  project_name: string;
  manager_login: string;
}

/**
 * Finds a random enabled project with an enabled PM.
 * The manager must be able to log in and manage close tags.
 */
export async function findProjectWithManager(
  db: DbClient,
): Promise<ProjectWithManagerRow> {
  return db.queryOne<ProjectWithManagerRow>(
    `SELECT p.id AS project_id,
            p.name AS project_name,
            e.login AS manager_login
     FROM ttt_backend.project p
     JOIN ttt_backend.employee e ON p.manager = e.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND e.login IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
}

interface CloseTagRow {
  tag_id: number;
  tag: string;
}

/** Lists existing close tags for a project. */
export async function listCloseTags(
  db: DbClient,
  projectId: number,
): Promise<CloseTagRow[]> {
  return db.query<CloseTagRow>(
    `SELECT id AS tag_id, tag
     FROM ttt_backend.planner_close_tag
     WHERE project_id = $1
     ORDER BY id`,
    [projectId],
  );
}

/** Checks if a specific tag exists for a project. */
export async function tagExists(
  db: DbClient,
  projectId: number,
  tag: string,
): Promise<boolean> {
  const rows = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
     FROM ttt_backend.planner_close_tag
     WHERE project_id = $1 AND LOWER(tag) = LOWER($2)`,
    [projectId, tag],
  );
  return Number(rows[0]?.cnt) > 0;
}

interface ProjectWithSeniorManagerRow {
  project_id: number;
  project_name: string;
  spm_login: string;
}

/**
 * Finds a random enabled project with an enabled senior project manager (SPM).
 * The SPM is stored in project.senior_manager_id.
 */
export async function findProjectWithSeniorManager(
  db: DbClient,
): Promise<ProjectWithSeniorManagerRow> {
  return db.queryOne<ProjectWithSeniorManagerRow>(
    `SELECT p.id AS project_id,
            p.name AS project_name,
            e.login AS spm_login
     FROM ttt_backend.project p
     JOIN ttt_backend.employee e ON p.senior_manager = e.id
     WHERE e.enabled = true
       AND p.status = 'ACTIVE'
       AND e.login IS NOT NULL
       AND p.senior_manager IS NOT NULL
     ORDER BY random()
     LIMIT 1`,
  );
}

interface TwoProjectsRow {
  project_a_id: number;
  project_a_name: string;
  pm_a_login: string;
  project_b_id: number;
  project_b_name: string;
  pm_b_login: string;
}

/**
 * Finds two distinct ACTIVE projects with different PMs.
 * PM of project B is NOT the PM or SPM of project A.
 */
export async function findTwoProjectsWithDifferentManagers(
  db: DbClient,
): Promise<TwoProjectsRow> {
  return db.queryOne<TwoProjectsRow>(
    `SELECT a.id AS project_a_id, a.name AS project_a_name, ea.login AS pm_a_login,
            b.id AS project_b_id, b.name AS project_b_name, eb.login AS pm_b_login
     FROM ttt_backend.project a
     JOIN ttt_backend.employee ea ON a.manager = ea.id
     JOIN ttt_backend.project b ON b.id != a.id
     JOIN ttt_backend.employee eb ON b.manager = eb.id
     WHERE a.status = 'ACTIVE' AND b.status = 'ACTIVE'
       AND ea.enabled = true AND eb.enabled = true
       AND ea.login IS NOT NULL AND eb.login IS NOT NULL
       AND eb.id != a.manager
       AND eb.id != COALESCE(a.senior_manager, 0)
       AND eb.id != COALESCE(a.old_owner, 0)
     ORDER BY random()
     LIMIT 1`,
  );
}

// --------------- Apply suite support ---------------

interface ApplyTargetRow {
  project_id: number;
  project_name: string;
  manager_login: string;
  assignment_id: number;
  assignment_date: string;
  task_id: number;
  task_name: string;
  ticket_info: string;
}

/**
 * Finds a project + assignment with ticket_info and NO reports on the date.
 * Suitable for apply-close-by-tag tests where the assignment should be closed.
 * Prefers recent dates (last 7 days) to increase planner visibility.
 */
export async function findApplyTargetNoReports(
  db: DbClient,
): Promise<ApplyTargetRow> {
  return db.queryOne<ApplyTargetRow>(
    `SELECT t.project AS project_id, p.name AS project_name,
            e.login AS manager_login,
            ta.id AS assignment_id, ta.date::text AS assignment_date,
            t.id AS task_id, t.name AS task_name, t.ticket_info
     FROM ttt_backend.task_assignment ta
     JOIN ttt_backend.task t ON ta.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     JOIN ttt_backend.employee e ON p.manager = e.id
     WHERE p.status = 'ACTIVE'
       AND e.enabled = true AND e.login IS NOT NULL
       AND t.ticket_info IS NOT NULL AND t.ticket_info != ''
       AND ta.closed = false
       AND ta.date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_report tr
         WHERE tr.task = t.id AND tr.executor = ta.assignee AND tr.report_date = ta.date
       )
     ORDER BY ABS(ta.date - CURRENT_DATE), random()
     LIMIT 1`,
  );
}

/**
 * Finds a project + assignment with ticket_info AND existing reports on the date.
 * Used to verify apply does NOT close assignments with reported hours.
 */
export async function findApplyTargetWithReports(
  db: DbClient,
): Promise<ApplyTargetRow> {
  return db.queryOne<ApplyTargetRow>(
    `SELECT t.project AS project_id, p.name AS project_name,
            e.login AS manager_login,
            ta.id AS assignment_id, ta.date::text AS assignment_date,
            t.id AS task_id, t.name AS task_name, t.ticket_info
     FROM ttt_backend.task_assignment ta
     JOIN ttt_backend.task t ON ta.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     JOIN ttt_backend.employee e ON p.manager = e.id
     JOIN ttt_backend.task_report tr
       ON tr.task = t.id AND tr.executor = ta.assignee AND tr.report_date = ta.date
     WHERE p.status = 'ACTIVE'
       AND e.enabled = true AND e.login IS NOT NULL
       AND t.ticket_info IS NOT NULL AND t.ticket_info != ''
       AND ta.closed = false
       AND ta.date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
     ORDER BY ABS(ta.date - CURRENT_DATE), random()
     LIMIT 1`,
  );
}

/** Returns the closed status of a specific task assignment. */
export async function getAssignmentClosedStatus(
  db: DbClient,
  assignmentId: number,
): Promise<boolean> {
  const row = await db.queryOne<{ closed: boolean }>(
    `SELECT closed FROM ttt_backend.task_assignment WHERE id = $1`,
    [assignmentId],
  );
  return row.closed;
}

/** Reopens a closed assignment (sets closed=false). Used for test cleanup. */
export async function reopenAssignment(
  db: DbClient,
  assignmentId: number,
): Promise<void> {
  await db.query(
    `UPDATE ttt_backend.task_assignment SET closed = false WHERE id = $1`,
    [assignmentId],
  );
}

/** Inserts a close tag for a project. Used for test setup. */
export async function insertTag(
  db: DbClient,
  projectId: number,
  tag: string,
): Promise<void> {
  await db.query(
    `INSERT INTO ttt_backend.planner_close_tag (project_id, tag)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [projectId, tag],
  );
}

/** Deletes a close tag by project + tag name (case-insensitive). Used for test cleanup. */
export async function deleteTagByName(
  db: DbClient,
  projectId: number,
  tag: string,
): Promise<void> {
  await db.query(
    `DELETE FROM ttt_backend.planner_close_tag
     WHERE project_id = $1 AND LOWER(tag) = LOWER($2)`,
    [projectId, tag],
  );
}

// --------------- TC-021: Date-scoped apply ---------------

interface TwoDatesApplyRow {
  project_id: number;
  project_name: string;
  manager_login: string;
  assignment1_id: number;
  assignment1_date: string;
  assignment2_id: number;
  assignment2_date: string;
  task_id: number;
  task_name: string;
  ticket_info: string;
}

/**
 * Finds two unclosed assignments for the same task+assignee on different dates,
 * both without reports. Used to verify date-scoped apply.
 */
export async function findApplyTargetTwoDatesNoReports(
  db: DbClient,
): Promise<TwoDatesApplyRow> {
  return db.queryOne<TwoDatesApplyRow>(
    `SELECT t.project AS project_id, p.name AS project_name,
            e.login AS manager_login,
            ta1.id AS assignment1_id, ta1.date::text AS assignment1_date,
            ta2.id AS assignment2_id, ta2.date::text AS assignment2_date,
            t.id AS task_id, t.name AS task_name, t.ticket_info
     FROM ttt_backend.task_assignment ta1
     JOIN ttt_backend.task_assignment ta2
       ON ta2.task = ta1.task AND ta2.assignee = ta1.assignee AND ta2.date != ta1.date
     JOIN ttt_backend.task t ON ta1.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     JOIN ttt_backend.employee e ON p.manager = e.id
     WHERE p.status = 'ACTIVE'
       AND e.enabled = true AND e.login IS NOT NULL
       AND t.ticket_info IS NOT NULL AND t.ticket_info != ''
       AND ta1.closed = false AND ta2.closed = false
       AND ta1.date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
       AND ta2.date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
       AND ta1.date < ta2.date
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_report tr
         WHERE tr.task = t.id AND tr.executor = ta1.assignee AND tr.report_date = ta1.date
       )
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_report tr
         WHERE tr.task = t.id AND tr.executor = ta2.assignee AND tr.report_date = ta2.date
       )
     ORDER BY random()
     LIMIT 1`,
  );
}

// --------------- TC-022: No-changes verification ---------------

/** Finds an unclosed assignment for a project (to verify no-op behavior). */
export async function findUnclosedAssignmentForProject(
  db: DbClient,
  projectId: number,
): Promise<{ assignment_id: number; assignment_date: string } | null> {
  const rows = await db.query<{ assignment_id: number; assignment_date: string }>(
    `SELECT ta.id AS assignment_id, ta.date::text AS assignment_date
     FROM ttt_backend.task_assignment ta
     JOIN ttt_backend.task t ON ta.task = t.id
     WHERE t.project = $1 AND ta.closed = false
       AND ta.date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
     ORDER BY random() LIMIT 1`,
    [projectId],
  );
  return rows.length > 0 ? rows[0] : null;
}

// --------------- TC-025: Generated assignment support ---------------

interface GeneratedAssignmentTargetRow {
  project_id: number;
  project_name: string;
  manager_login: string;
  task_id: number;
  task_name: string;
  ticket_info: string;
  bound_employee_id: number;
  target_date: string;
}

/**
 * Finds a task with ticket_info and a fixed (bound) employee who has NO existing
 * task_assignment on a recent date but DOES have assignments on other dates.
 * The "other dates" requirement ensures the planner section generation
 * knows about this employee for this task.
 * Table: fixed_task (task, employee) binds employees to tasks.
 */
export async function findGeneratedAssignmentTarget(
  db: DbClient,
): Promise<GeneratedAssignmentTargetRow> {
  return db.queryOne<GeneratedAssignmentTargetRow>(
    `WITH candidate_dates AS (
       -- Find a date where the employee has NO assignment but HAS one on adjacent dates
       SELECT ft.task, ft.employee, to_char(d.dt, 'YYYY-MM-DD') AS target_date
       FROM ttt_backend.fixed_task ft
       CROSS JOIN generate_series(CURRENT_DATE - 7, CURRENT_DATE - 1, '1 day'::interval) AS d(dt)
       WHERE NOT EXISTS (
         SELECT 1 FROM ttt_backend.task_assignment ta
         WHERE ta.task = ft.task AND ta.assignee = ft.employee AND ta.date = d.dt
       )
       AND EXISTS (
         SELECT 1 FROM ttt_backend.task_assignment ta2
         WHERE ta2.task = ft.task AND ta2.assignee = ft.employee
           AND ta2.date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE
       )
     )
     SELECT t.project AS project_id, p.name AS project_name,
            e.login AS manager_login,
            t.id AS task_id, t.name AS task_name, t.ticket_info,
            cd.employee AS bound_employee_id,
            cd.target_date
     FROM candidate_dates cd
     JOIN ttt_backend.task t ON cd.task = t.id
     JOIN ttt_backend.project p ON t.project = p.id
     JOIN ttt_backend.employee e ON p.manager = e.id
     JOIN ttt_backend.employee be ON cd.employee = be.id
     WHERE p.status = 'ACTIVE'
       AND e.enabled = true AND e.login IS NOT NULL
       AND be.enabled = true
       AND t.ticket_info IS NOT NULL AND t.ticket_info != ''
     ORDER BY random()
     LIMIT 1`,
  );
}

/** Finds a task assignment by task, employee, and date. */
export async function findAssignmentByTaskEmployeeDate(
  db: DbClient,
  taskId: number,
  employeeId: number,
  date: string,
): Promise<{ id: number; closed: boolean } | null> {
  const rows = await db.query<{ id: number; closed: boolean }>(
    `SELECT id, closed FROM ttt_backend.task_assignment
     WHERE task = $1 AND assignee = $2 AND date = $3`,
    [taskId, employeeId, date],
  );
  return rows.length > 0 ? rows[0] : null;
}

/** Deletes a specific task assignment by ID. Used for test cleanup. */
export async function deleteAssignment(
  db: DbClient,
  assignmentId: number,
): Promise<void> {
  await db.query(
    `DELETE FROM ttt_backend.task_assignment WHERE id = $1`,
    [assignmentId],
  );
}

/** Finds an ACTIVE project with a PM but no existing close tags. */
export async function findProjectWithNoTags(
  db: DbClient,
): Promise<ProjectWithManagerRow> {
  return db.queryOne<ProjectWithManagerRow>(
    `SELECT p.id AS project_id, p.name AS project_name, e.login AS manager_login
     FROM ttt_backend.project p
     JOIN ttt_backend.employee e ON p.manager = e.id
     WHERE p.status = 'ACTIVE'
       AND e.enabled = true
       AND e.login IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.planner_close_tag pct WHERE pct.project_id = p.id
       )
     ORDER BY random()
     LIMIT 1`,
  );
}

interface ProjectWithPlainMemberRow {
  project_id: number;
  project_name: string;
  pm_login: string;
  member_login: string;
}

/** Finds an ACTIVE project with a PM and a separate plain member (not PM/SPM/admin). */
export async function findProjectWithPlainMember(
  db: DbClient,
): Promise<ProjectWithPlainMemberRow> {
  return db.queryOne<ProjectWithPlainMemberRow>(
    `SELECT p.id AS project_id, p.name AS project_name,
            pm.login AS pm_login, m.login AS member_login
     FROM ttt_backend.project p
     JOIN ttt_backend.employee pm ON p.manager = pm.id
     JOIN ttt_backend.project_member mem ON mem.project = p.id
     JOIN ttt_backend.employee m ON mem.employee = m.id
     WHERE p.status = 'ACTIVE'
       AND pm.enabled = true
       AND m.enabled = true
       AND m.id != p.manager
       AND m.id != COALESCE(p.senior_manager, 0)
       AND m.id != COALESCE(p.old_owner, 0)
       AND pm.login IS NOT NULL
       AND m.login IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM ttt_backend.employee_global_roles egr
         WHERE egr.employee = m.id
         AND egr.role_name IN ('ROLE_ADMIN', 'ROLE_DEPARTMENT_MANAGER', 'ROLE_CHIEF_OFFICER')
       )
     ORDER BY random()
     LIMIT 1`,
  );
}
