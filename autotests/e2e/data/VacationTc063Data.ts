declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-063: Edit dates resets all optional approvals to ASKED.
 *
 * API test: Create vacation with optional approvers → approve → update dates →
 * verify optional approval statuses reset from APPROVED to ASKED, main status from APPROVED to NEW.
 *
 * Note: Update endpoint requires `id` field in request body (in addition to URL path).
 */
export class VacationTc063Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  /** Shifted dates for the update step (1 week later than original) */
  readonly updatedStartDate: string;
  readonly updatedEndDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly optionalApproverLogins: string[];
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc063Data> {
    if (mode === "static") return new VacationTc063Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      // Need two non-overlapping weeks: original and updated
      const { startDate, endDate } =
        await VacationTc063Data.findAvailableWeek(db, login, 203);

      // Updated dates: 1 week after original
      const origStart = new Date(startDate + "T00:00:00Z");
      const updStart = new Date(origStart);
      updStart.setDate(origStart.getDate() + 7);
      const updEnd = new Date(updStart);
      updEnd.setDate(updStart.getDate() + 4);

      const updatedStartDate = toIso(updStart);
      const updatedEndDate = toIso(updEnd);

      // Verify updated range is also conflict-free
      const conflict = await hasVacationConflict(db, login, updatedStartDate, updatedEndDate);
      if (conflict) {
        // Try 2 weeks later instead
        updStart.setDate(updStart.getDate() + 7);
        updEnd.setDate(updEnd.getDate() + 7);
        const alt1 = toIso(updStart);
        const alt2 = toIso(updEnd);
        const conflict2 = await hasVacationConflict(db, login, alt1, alt2);
        if (conflict2) {
          throw new Error("Cannot find two conflict-free weeks for TC-063");
        }
        return new VacationTc063Data(
          login, startDate, endDate, alt1, alt2,
          await VacationTc063Data.findOptionalApprovers(db, login),
        );
      }

      const approvers = await VacationTc063Data.findOptionalApprovers(db, login);
      return new VacationTc063Data(login, startDate, endDate, updatedStartDate, updatedEndDate, approvers);
    } finally {
      await db.close();
    }
  }

  private static async findOptionalApprovers(
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
    login = process.env.VACATION_TC063_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC063_START ?? "2030-02-18",
    endDate = process.env.VACATION_TC063_END ?? "2030-02-22",
    updatedStartDate = process.env.VACATION_TC063_UPD_START ?? "2030-02-25",
    updatedEndDate = process.env.VACATION_TC063_UPD_END ?? "2030-03-01",
    optionalApproverLogins = ["mpotter", "zmustafina"],
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.updatedStartDate = updatedStartDate;
    this.updatedEndDate = updatedEndDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.optionalApproverLogins = optionalApproverLogins;
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

  /** Update body with shifted dates. Requires `id` field (discovered in session 85). */
  buildUpdateBody(vacationId: number): Record<string, unknown> {
    return {
      id: vacationId,
      login: this.login,
      startDate: this.updatedStartDate,
      endDate: this.updatedEndDate,
      paymentType: this.paymentType,
      paymentMonth: this.updatedStartDate.slice(0, 7) + "-01",
      optionalApprovers: this.optionalApproverLogins,
      notifyAlso: [],
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
