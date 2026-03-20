declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-065: Notify-also with required=true acts as mandatory approver.
 *
 * API test: POST create with notifyAlso list → verify vacation_notify_also records in DB.
 * The DTO accepts notifyAlso as List<String> (login strings).
 * Server-side, InternalNotifyAlsoService sets required=true for watchers from
 * EmployeeWatcherService.listRequired() and required=false for user-submitted logins.
 *
 * BUG FINDING: EmployeeWatcherServiceImpl.listRequired() is a no-op stub (returns empty list).
 * Therefore required=true is NEVER set — all notifyAlso entries get required=false.
 * The "mandatory approver via notifyAlso" feature is effectively dead code.
 */
export class VacationTc065Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly notifyAlsoLogins: string[];
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc065Data> {
    if (mode === "static") return new VacationTc065Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc065Data.findAvailableWeek(db, login, 224);

      const notifyAlsoLogins =
        await VacationTc065Data.findNotifyAlsoLogins(db, login);

      return new VacationTc065Data(login, startDate, endDate, notifyAlsoLogins);
    } finally {
      await db.close();
    }
  }

  private static async findNotifyAlsoLogins(
    db: DbClient,
    ownerLogin: string,
  ): Promise<string[]> {
    const rows = await db.query(
      `SELECT e.login FROM ttt_vacation.employee e
       WHERE e.is_working = true AND e.enabled = true
       AND e.login != $1
       AND e.office_id = (SELECT office_id FROM ttt_vacation.employee WHERE login = $1)
       LIMIT 2`,
      [ownerLogin],
    );
    if (rows.length >= 2) {
      return rows.map((r: Record<string, unknown>) => r.login as string);
    }
    const fallback = await db.query(
      `SELECT e.login FROM ttt_vacation.employee e
       WHERE e.is_working = true AND e.enabled = true AND e.login != $1
       LIMIT 2`,
      [ownerLogin],
    );
    return fallback.map((r: Record<string, unknown>) => r.login as string);
  }

  private static async findAvailableWeek(
    db: DbClient,
    login: string,
    startWeekOffset = 0,
  ): Promise<{ startDate: string; endDate: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    for (let attempt = 0; attempt < 24; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

      const startIso = toIso(start);
      const endIso = toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return { startDate: startIso, endDate: endIso };
      }
    }
    throw new Error(
      `No conflict-free Mon-Fri window for "${login}" within 24 weeks from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC065_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC065_START ?? "2030-07-01",
    endDate = process.env.VACATION_TC065_END ?? "2030-07-05",
    notifyAlsoLogins = ["mpotter", "zmustafina"],
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.notifyAlsoLogins = notifyAlsoLogins;
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      optionalApprovers: [],
      notifyAlso: this.notifyAlsoLogins,
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
