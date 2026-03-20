declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-033: Update — verify optional approvals reset on date change.
 *
 * API test: Create vacation with optional approvers, update dates, verify
 * vacation_approval records are reset to ASKED status after the update.
 * NOTE: Cannot set optional approval to APPROVED via API (no endpoint exists),
 * so this test verifies approvals survive the update with ASKED status intact.
 */
export class VacationTc033Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly updatedStartDate: string;
  readonly updatedEndDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly updatedPaymentMonth: string;
  readonly optionalApproverLogins: string[];
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc033Data> {
    if (mode === "static") return new VacationTc033Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      // Find two consecutive conflict-free weeks
      const week1 = await VacationTc033Data.findAvailableWeek(db, login, 179);
      const week2 = await VacationTc033Data.findAvailableWeek(
        db,
        login,
        179,
        week1.endDate,
      );

      const approverLogins =
        await VacationTc033Data.findOptionalApprovers(db, login);

      return new VacationTc033Data(
        login,
        week1.startDate,
        week1.endDate,
        week2.startDate,
        week2.endDate,
        approverLogins,
      );
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
    afterDate?: string,
  ): Promise<{ startDate: string; endDate: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    // If afterDate provided, skip to the week after that date
    if (afterDate) {
      const after = new Date(afterDate);
      while (monday <= after) {
        monday.setDate(monday.getDate() + 7);
      }
    }

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
    login = process.env.VACATION_TC033_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC033_START ?? "2029-07-23",
    endDate = process.env.VACATION_TC033_END ?? "2029-07-27",
    updatedStartDate = process.env.VACATION_TC033_UPD_START ?? "2029-07-30",
    updatedEndDate = process.env.VACATION_TC033_UPD_END ?? "2029-08-03",
    optionalApproverLogins = ["mpotter", "zmustafina"],
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.updatedStartDate = updatedStartDate;
    this.updatedEndDate = updatedEndDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.updatedPaymentMonth = updatedStartDate.slice(0, 7) + "-01";
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

  buildUpdateBody(vacationId: number): Record<string, unknown> {
    return {
      id: vacationId,
      login: this.login,
      startDate: this.updatedStartDate,
      endDate: this.updatedEndDate,
      paymentType: this.paymentType,
      paymentMonth: this.updatedPaymentMonth,
      optionalApprovers: this.optionalApproverLogins,
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
