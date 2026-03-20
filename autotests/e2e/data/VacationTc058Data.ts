declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-058: Optional approver approves (ASKED -> APPROVED).
 *
 * API test: Create vacation with optional approvers → PATCH optional approval
 * status from ASKED to APPROVED → verify DB updated, main status unchanged.
 * Optional approvals are informational — they don't drive the main vacation status.
 */
export class VacationTc058Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly optionalApproverLogin: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly optionalApprovalEndpoint = "/api/vacation/v1/employee-dayOff-approvers";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc058Data> {
    if (mode === "static") return new VacationTc058Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc058Data.findAvailableWeek(db, login, 176);

      const approverLogin =
        await VacationTc058Data.findOptionalApprover(db, login);

      return new VacationTc058Data(login, startDate, endDate, approverLogin);
    } finally {
      await db.close();
    }
  }

  private static async findOptionalApprover(
    db: DbClient,
    ownerLogin: string,
  ): Promise<string> {
    const rows = await db.query(
      `SELECT e.login FROM ttt_vacation.employee e
       WHERE e.is_working = true AND e.enabled = true
       AND e.login != $1
       AND e.office_id = (SELECT office_id FROM ttt_vacation.employee WHERE login = $1)
       LIMIT 1`,
      [ownerLogin],
    );
    if (rows.length > 0) {
      return rows[0].login as string;
    }
    const fallback = await db.query(
      `SELECT e.login FROM ttt_vacation.employee e
       WHERE e.is_working = true AND e.enabled = true AND e.login != $1
       LIMIT 1`,
      [ownerLogin],
    );
    if (fallback.length === 0) {
      throw new Error("No active employee found for optional approver");
    }
    return fallback[0].login as string;
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
    login = process.env.VACATION_TC058_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC058_START ?? "2029-08-06",
    endDate = process.env.VACATION_TC058_END ?? "2029-08-10",
    optionalApproverLogin = "mpotter",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.optionalApproverLogin = optionalApproverLogin;
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      optionalApprovers: [this.optionalApproverLogin],
      notifyAlso: [],
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
