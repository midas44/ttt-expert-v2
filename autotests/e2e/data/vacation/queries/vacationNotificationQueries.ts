import { DbClient } from "@ttt/config/db/dbClient";

export interface EmailRow {
  id: string;
  receiver: string;
  subject: string;
  status: string;
  add_time: string;
}

/**
 * Checks the ttt_email.email table for notification emails
 * sent after a given timestamp to a specific receiver.
 * @param subjectPattern - SQL LIKE pattern for the subject (e.g. '%заявка на отпуск%')
 */
export async function findNotificationEmails(
  db: DbClient,
  receiverEmail: string,
  afterTimestamp: string,
  subjectPattern: string,
): Promise<EmailRow[]> {
  return db.query<EmailRow>(
    `SELECT id::text, receiver, subject, status, add_time::text
     FROM ttt_email.email
     WHERE receiver ILIKE $1
       AND add_time > $2::timestamp
       AND subject LIKE $3
     ORDER BY add_time DESC`,
    [receiverEmail, afterTimestamp, subjectPattern],
  );
}

export interface EmployeeNotifInfo {
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  managerLogin: string;
  managerEmail: string;
}

/** Fetches employee and manager email info for notification tests. */
export async function getEmployeeNotifInfo(
  db: DbClient,
  login: string,
): Promise<EmployeeNotifInfo> {
  const row = await db.queryOne<{
    login: string;
    email: string;
    first_name: string;
    last_name: string;
    mgr_login: string;
    mgr_email: string;
  }>(
    `SELECT ve.login,
            ve.email,
            ve.latin_first_name AS first_name,
            ve.latin_last_name AS last_name,
            m.login AS mgr_login,
            m.email AS mgr_email
     FROM ttt_vacation.employee ve
     LEFT JOIN ttt_vacation.employee m ON ve.manager = m.id
     WHERE ve.login = $1`,
    [login],
  );
  return {
    login: row.login,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    managerLogin: row.mgr_login,
    managerEmail: row.mgr_email,
  };
}

/** Returns the current DB server timestamp as ISO string. */
export async function getDbTimestamp(db: DbClient): Promise<string> {
  const row = await db.queryOne<{ ts: string }>(
    `SELECT NOW()::text AS ts`,
  );
  return row.ts;
}

/** Returns the server's current date as a JS Date (uses DB clock, not local clock).
 *  Critical for QA envs with manipulated test clocks. */
export async function getServerDate(db: DbClient): Promise<Date> {
  const row = await db.queryOne<{ d: string }>(
    `SELECT CURRENT_DATE::text AS d`,
  );
  return new Date(row.d + "T12:00:00Z");
}

/**
 * Finds a conflict-free Mon-Fri week for the given employee,
 * using the server's clock (not local machine date).
 */
export async function findAvailableWeekFromServer(
  db: DbClient,
  login: string,
  weeksAhead: number,
  maxAttempts = 20,
): Promise<{ startDate: string; endDate: string }> {
  const { hasVacationConflict } = await import("./vacationQueries");
  const now = await getServerDate(db);
  const day = now.getUTCDay();
  const daysToMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const base = new Date(now);
  base.setUTCDate(now.getUTCDate() + daysToMon + weeksAhead * 7);

  for (let i = 0; i < maxAttempts; i++) {
    const start = new Date(base);
    start.setUTCDate(base.getUTCDate() + i * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 4);
    const s = start.toISOString().slice(0, 10);
    const e = end.toISOString().slice(0, 10);
    if (!(await hasVacationConflict(db, login, s, e))) {
      return { startDate: s, endDate: e };
    }
  }
  throw new Error(`No conflict-free week for ${login}`);
}
