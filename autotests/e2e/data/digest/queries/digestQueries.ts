import { DbClient } from "@ttt/config/db/dbClient";

/**
 * Digest-collection shared queries (TTT vacation digest cron job).
 *
 * Schema notes:
 *   • `ttt_vacation.vacation` columns: id, employee (FK to ttt_vacation.employee.id),
 *     start_date, end_date, status, payment_type, period_type. There is NO
 *     `vacation_type` column — the digest XLSX preconditions used that name
 *     loosely; actual storage is `payment_type` (REGULAR / ADMINISTRATIVE).
 *   • `ttt_vacation.employee` columns: id, login, email, latin_first_name,
 *     latin_last_name, russian_first_name, russian_last_name, manager, enabled.
 *     The email template renders Russian display name (`russian_first_name` +
 *     `russian_last_name`); Latin is a fallback when Russian fields are empty.
 */

export interface DigestVacationRow {
  vacation_id: number;
  employee_id: number;
  login: string;
  email: string;
  russian_first_name: string | null;
  russian_last_name: string | null;
  latin_first_name: string | null;
  latin_last_name: string | null;
  start_date: string;
  end_date: string;
  payment_type: string;
  status: string;
}

/**
 * Count APPROVED vacations starting tomorrow (`CURRENT_DATE + 1`). Used as a
 * guard for no-digest TCs (TC-DIGEST-003 / 004) and as a sanity check before
 * seeding TC-DIGEST-001 / 002.
 */
export async function countApprovedTomorrow(db: DbClient): Promise<number> {
  const row = await db.queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
     FROM ttt_vacation.vacation
     WHERE status = 'APPROVED'
       AND start_date = CURRENT_DATE + INTERVAL '1 day'`,
  );
  return parseInt(row.cnt, 10);
}

/**
 * Find an existing APPROVED vacation starting tomorrow (any employee). Used by
 * content-complete TCs (TC-DIGEST-001 / 002) to discover a ready-made seed
 * before falling back to API-seeded creation.
 */
export async function findApprovedTomorrow(
  db: DbClient,
): Promise<DigestVacationRow | null> {
  const row = await db.queryOne<DigestVacationRow | null>(
    `SELECT v.id AS vacation_id,
            e.id AS employee_id,
            e.login,
            e.email,
            e.russian_first_name,
            e.russian_last_name,
            e.latin_first_name,
            e.latin_last_name,
            v.start_date::text AS start_date,
            v.end_date::text AS end_date,
            v.payment_type,
            v.status
     FROM ttt_vacation.vacation v
     JOIN ttt_vacation.employee e ON e.id = v.employee
     WHERE v.status = 'APPROVED'
       AND v.start_date = CURRENT_DATE + INTERVAL '1 day'
       AND e.enabled = true
       AND e.email IS NOT NULL
       AND e.email != ''
     ORDER BY random()
     LIMIT 1`,
  );
  return row ?? null;
}

export interface EmployeeDisplayInfo {
  login: string;
  email: string;
  russianFirstName: string;
  russianLastName: string;
  latinFirstName: string;
  latinLastName: string;
}

/**
 * Fetch display fields for an employee. Used by the data classes to build the
 * content-complete assertion set without hard-coding names.
 */
export async function getEmployeeDisplayInfo(
  db: DbClient,
  login: string,
): Promise<EmployeeDisplayInfo> {
  const row = await db.queryOne<{
    login: string;
    email: string;
    russian_first_name: string | null;
    russian_last_name: string | null;
    latin_first_name: string | null;
    latin_last_name: string | null;
  }>(
    `SELECT login,
            email,
            russian_first_name,
            russian_last_name,
            latin_first_name,
            latin_last_name
     FROM ttt_vacation.employee
     WHERE login = $1`,
    [login],
  );
  return {
    login: row.login,
    email: row.email,
    russianFirstName: row.russian_first_name ?? "",
    russianLastName: row.russian_last_name ?? "",
    latinFirstName: row.latin_first_name ?? "",
    latinLastName: row.latin_last_name ?? "",
  };
}

/**
 * Returns the server's current date as a JS Date (uses DB clock, not the local
 * machine clock). Critical for envs with manipulated test clocks.
 */
export async function getServerDate(db: DbClient): Promise<Date> {
  const row = await db.queryOne<{ d: string }>(
    `SELECT CURRENT_DATE::text AS d`,
  );
  return new Date(row.d + "T12:00:00Z");
}

/**
 * Format a date as `DD.MM.YYYY` (Russian locale). Used to assert body field
 * values against email output.
 */
export function formatRu(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Russian plural form for a day count. Rules (from
 * `patterns/email-notification-triggers.md`):
 *   • 1, 21, 31, … → `день`
 *   • 2–4, 22–24, … → `дня`
 *   • 0, 5–20, 25–30, … → `дней`
 */
export function russianDayPluralWord(days: number): string {
  const abs = Math.abs(days);
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

/** Inclusive day count for a vacation (start == end → 1). */
export function inclusiveDayCount(startIso: string, endIso: string): number {
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / 86_400_000) + 1;
}
