declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

interface PaidVacationRow {
  id: number;
  login: string;
  start_date: string;
  end_date: string;
  payment_type: string;
}

/**
 * Test data for TC-VAC-030: Update PAID vacation — immutable.
 *
 * API test: PUT /api/vacation/v1/vacations/{id} on a PAID vacation.
 * Expects: HTTP 400 — PAID is in NON_EDITABLE_STATUSES, permission service returns empty set.
 * Uses an existing PAID vacation from DB (we can't create PAID without accountant role).
 */
export class VacationTc030Data {
  readonly paidVacationId: number;
  readonly login: string;
  readonly originalStartDate: string;
  readonly originalEndDate: string;
  readonly paymentType: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc030Data> {
    if (mode === "static") return new VacationTc030Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const db = new DbClient(tttConfig);
    try {
      // Find an existing PAID vacation owned by pvaynmaster
      let row = await db.queryOneOrNull<PaidVacationRow>(
        `SELECT v.id, ve.login, v.start_date::text, v.end_date::text, v.payment_type
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee ve ON ve.id = v.employee
         WHERE v.status = 'PAID'
           AND ve.login = 'pvaynmaster'
         ORDER BY v.id DESC
         LIMIT 1`,
      );

      // Fallback: any PAID vacation
      if (!row) {
        row = await db.queryOneOrNull<PaidVacationRow>(
          `SELECT v.id, ve.login, v.start_date::text, v.end_date::text, v.payment_type
           FROM ttt_vacation.vacation v
           JOIN ttt_vacation.employee ve ON ve.id = v.employee
           WHERE v.status = 'PAID'
           ORDER BY v.id DESC
           LIMIT 1`,
        );
      }

      if (!row) {
        throw new Error("No PAID vacation found in DB — cannot test immutability");
      }

      return new VacationTc030Data(
        row.id,
        row.login,
        row.start_date,
        row.end_date,
        row.payment_type,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    paidVacationId = Number(process.env.VACATION_TC030_ID ?? "1"),
    login = process.env.VACATION_TC030_LOGIN ?? "pvaynmaster",
    originalStartDate = process.env.VACATION_TC030_START ?? "2026-01-12",
    originalEndDate = process.env.VACATION_TC030_END ?? "2026-01-16",
    paymentType = process.env.VACATION_TC030_TYPE ?? "REGULAR",
  ) {
    this.paidVacationId = paidVacationId;
    this.login = login;
    this.originalStartDate = originalStartDate;
    this.originalEndDate = originalEndDate;
    this.paymentType = paymentType;
  }

  /** Build update body attempting to shift dates by 1 week */
  buildUpdateBody(): Record<string, unknown> {
    const start = new Date(this.originalStartDate);
    start.setDate(start.getDate() + 7);
    const end = new Date(this.originalEndDate);
    end.setDate(end.getDate() + 7);

    return {
      id: this.paidVacationId,
      login: this.login,
      startDate: toIso(start),
      endDate: toIso(end),
      paymentType: this.paymentType,
      paymentMonth: toIso(start).slice(0, 7) + "-01",
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
