declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-044: APPROVED → NEW (employee edits dates).
 *
 * API test: Create vacation, approve it, then PUT with changed dates.
 * Expects: status resets from APPROVED back to NEW.
 */
export class VacationTc044Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly updatedStartDate: string;
  readonly updatedEndDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly updatedPaymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc044Data> {
    if (mode === "static") return new VacationTc044Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const original = await VacationTc044Data.findAvailableWeek(
        db, login, 18,
      );
      const updated = await VacationTc044Data.findAvailableWeek(
        db, login, 21,
      );
      return new VacationTc044Data(
        login,
        original.startDate, original.endDate,
        updated.startDate, updated.endDate,
      );
    } finally {
      await db.close();
    }
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

    for (let attempt = 0; attempt < 12; attempt++) {
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
      `No conflict-free Mon-Fri window for "${login}" within 12 weeks`,
    );
  }

  constructor(
    login = process.env.VACATION_TC044_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC044_START ?? "2026-08-03",
    endDate = process.env.VACATION_TC044_END ?? "2026-08-07",
    updatedStartDate = process.env.VACATION_TC044_UPD_START ?? "2026-08-24",
    updatedEndDate = process.env.VACATION_TC044_UPD_END ?? "2026-08-28",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.updatedStartDate = updatedStartDate;
    this.updatedEndDate = updatedEndDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.updatedPaymentMonth = updatedStartDate.slice(0, 7) + "-01";
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      optionalApprovers: [],
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
