declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * Test data for TC-VAC-171: Boundary — past start date rejected, present/future accepted.
 *
 * API test: POST /api/vacation/v1/vacations twice:
 *   1. startDate = first available date >= today → expect 200
 *   2. startDate = yesterday → expect 400 (validation.vacation.start.date.in.past)
 *
 * Validation: startDate.isBefore(today) — strict less-than.
 * Today is NOT "before" today, so it passes.
 *
 * Note: crossing check includes DELETED vacations, so we must find a conflict-free
 * date via DB to ensure rerunnability.
 */
export class VacationTc171Data {
  readonly login: string;
  readonly acceptedStartDate: string;
  readonly acceptedEndDate: string;
  readonly rejectedStartDate: string;
  readonly rejectedEndDate: string;
  readonly paymentType = "REGULAR";
  readonly acceptedPaymentMonth: string;
  readonly rejectedPaymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc171Data> {
    if (mode === "static") return new VacationTc171Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      // Find first conflict-free weekday from today forward
      const accepted = await VacationTc171Data.findAvailableDay(db, login);
      // Yesterday is always in the past — should be rejected
      const now = new Date();
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(now.getDate() - 1);
      const yesterday = toIso(yesterdayDate);

      return new VacationTc171Data(
        login,
        accepted,
        accepted,
        yesterday,
        yesterday,
      );
    } finally {
      await db.close();
    }
  }

  /**
   * Finds first conflict-free weekday from today forward.
   * Checks ALL vacation statuses including DELETED (crossing check includes them).
   */
  private static async findAvailableDay(
    db: DbClient,
    login: string,
  ): Promise<string> {
    const now = new Date();
    for (let offset = 0; offset < 365; offset++) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + offset);
      const dow = candidate.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends

      const iso = toIso(candidate);
      // Check ALL vacations (any status) — the crossing validation counts DELETED too
      const row = await db.queryOne<{ cnt: string }>(
        `SELECT count(*)::text AS cnt
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee ve ON ve.id = v.employee
         WHERE ve.login = $1
           AND v.start_date <= $2::date
           AND v.end_date >= $2::date`,
        [login, iso],
      );
      if (Number(row.cnt) === 0) {
        return iso;
      }
    }
    throw new Error(`No conflict-free weekday for "${login}" within 365 days`);
  }

  constructor(
    login = process.env.VACATION_TC171_LOGIN ?? "pvaynmaster",
    acceptedStartDate = process.env.VACATION_TC171_ACCEPTED_START ?? "2026-03-20",
    acceptedEndDate = process.env.VACATION_TC171_ACCEPTED_END ?? "2026-03-20",
    rejectedStartDate = process.env.VACATION_TC171_REJECTED_START ?? "2026-03-19",
    rejectedEndDate = process.env.VACATION_TC171_REJECTED_END ?? "2026-03-19",
  ) {
    this.login = login;
    this.acceptedStartDate = acceptedStartDate;
    this.acceptedEndDate = acceptedEndDate;
    this.rejectedStartDate = rejectedStartDate;
    this.rejectedEndDate = rejectedEndDate;
    this.acceptedPaymentMonth = acceptedStartDate.slice(0, 7) + "-01";
    this.rejectedPaymentMonth = rejectedStartDate.slice(0, 7) + "-01";
  }

  buildAcceptedCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.acceptedStartDate,
      endDate: this.acceptedEndDate,
      paymentType: this.paymentType,
      paymentMonth: this.acceptedPaymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  buildRejectedCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.rejectedStartDate,
      endDate: this.rejectedEndDate,
      paymentType: this.paymentType,
      paymentMonth: this.rejectedPaymentMonth,
      optionalApprovers: [],
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
