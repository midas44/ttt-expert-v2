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
