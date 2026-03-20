declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-067: Change approver preserves optional approver list.
 *
 * API test: Create vacation with 2 optional approvers → PUT /pass/{id} with new approver.
 * Expected: old primary added as optional (ASKED), existing optionals A/B preserved,
 * new approver C becomes primary (vacation.approver_id).
 */
export class VacationTc067Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly optionalApproverLogins: string[];
  readonly newApproverLogin: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc067Data> {
    if (mode === "static") return new VacationTc067Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc067Data.findAvailableWeek(db, login, 209);

      const optionals = await VacationTc067Data.findColleagues(db, login, 2);
      // New approver must be different from optional approvers — use employee from any office
      const newApprover = await VacationTc067Data.findNewApprover(db, login, optionals);

      return new VacationTc067Data(login, startDate, endDate, optionals, newApprover);
    } finally {
      await db.close();
    }
  }

  private static async findNewApprover(
    db: DbClient,
    ownerLogin: string,
    excludeLogins: string[],
  ): Promise<string> {
    const excludeList = [ownerLogin, ...excludeLogins].map((l) => `'${l}'`).join(",");
    const rows = await db.query(
      `SELECT e.login FROM ttt_vacation.employee e
       WHERE e.is_working = true AND e.enabled = true
       AND e.login NOT IN (${excludeList})
       LIMIT 1`,
      [],
    );
    if (rows.length === 0) throw new Error("No eligible new approver found");
    return rows[0].login as string;
  }

  private static async findColleagues(
    db: DbClient,
    ownerLogin: string,
    count: number,
  ): Promise<string[]> {
    const rows = await db.query(
      `SELECT e.login FROM ttt_vacation.employee e
       WHERE e.is_working = true AND e.enabled = true
       AND e.login != $1
       AND e.office_id = (SELECT office_id FROM ttt_vacation.employee WHERE login = $1)
       LIMIT $2`,
      [ownerLogin, count],
    );
    if (rows.length >= count) {
      return rows.map((r: Record<string, unknown>) => r.login as string);
    }
    // Fallback: any active employees
    const fallback = await db.query(
      `SELECT e.login FROM ttt_vacation.employee e
       WHERE e.is_working = true AND e.enabled = true AND e.login != $1
       LIMIT $2`,
      [ownerLogin, count],
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
    login = process.env.VACATION_TC067_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC067_START ?? "2030-03-18",
    endDate = process.env.VACATION_TC067_END ?? "2030-03-22",
    optionalApproverLogins = ["mpotter", "zmustafina"],
    newApproverLogin = "tkutsko",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.optionalApproverLogins = optionalApproverLogins;
    this.newApproverLogin = newApproverLogin;
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      optionalApprovers: this.optionalApproverLogins,
      notifyAlso: [],
    };
  }

  buildChangeApproverBody(): Record<string, unknown> {
    return {
      login: this.newApproverLogin,
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
