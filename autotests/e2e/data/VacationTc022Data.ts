declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-022: Create vacation with notifyAlso list.
 *
 * API test: POST with notifyAlso containing valid colleague logins.
 * Verifies: vacation created with 200, notifyAlso records persisted.
 */
export class VacationTc022Data {
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
  ): Promise<VacationTc022Data> {
    if (mode === "static") return new VacationTc022Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await VacationTc022Data.findAvailableWeek(
        db,
        login,
        120,
      );
      const colleagues = await VacationTc022Data.findColleagueLogins(db, login, 2);
      return new VacationTc022Data(login, startDate, endDate, colleagues);
    } finally {
      await db.close();
    }
  }

  private static async findColleagueLogins(
    db: DbClient,
    ownerLogin: string,
    count: number,
  ): Promise<string[]> {
    const rows = await db.query<{ login: string }>(
      `SELECT DISTINCT e.login
       FROM ttt_backend.employee e
       JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
       WHERE e.enabled = true
         AND e.login != $1
         AND r.role_name = 'ROLE_EMPLOYEE'
       ORDER BY e.login
       LIMIT $2`,
      [ownerLogin, count],
    );
    if (rows.length < count) {
      throw new Error(`Need ${count} colleague logins, found ${rows.length}`);
    }
    return rows.map((r) => r.login);
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
    login = process.env.VACATION_TC022_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC022_START ?? "2028-06-05",
    endDate = process.env.VACATION_TC022_END ?? "2028-06-09",
    notifyAlsoLogins: string[] = ["ilnitsky"],
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
      notifyAlso: this.notifyAlsoLogins,
      optionalApprovers: [],
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
