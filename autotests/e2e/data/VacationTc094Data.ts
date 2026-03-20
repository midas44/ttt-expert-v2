declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-094: Payment type alignment bug — admin vacation paid as regular.
 *
 * API test: Create ADMINISTRATIVE (1 day) → approve → pay with regularDaysPayed=1, administrativeDaysPayed=0.
 * BUG: checkForPayment only validates total match (regular + admin == days), NOT type alignment.
 * Expected: should reject mismatched payment type. Actual: HTTP 200 (incorrect classification).
 */
export class VacationTc094Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "ADMINISTRATIVE";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc094Data> {
    if (mode === "static") return new VacationTc094Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate } =
        await VacationTc094Data.findAvailableDay(db, login, 197);
      return new VacationTc094Data(login, startDate, startDate);
    } finally {
      await db.close();
    }
  }

  private static async findAvailableDay(
    db: DbClient,
    login: string,
    startWeekOffset = 0,
  ): Promise<{ startDate: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    for (let attempt = 0; attempt < 48; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const startIso = toIso(start);

      const conflict = await hasVacationConflict(db, login, startIso, startIso);
      if (!conflict) {
        return { startDate: startIso };
      }
    }
    throw new Error(
      `No conflict-free single day for "${login}" within 48 weeks from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC094_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC094_START ?? "2029-11-12",
    endDate = process.env.VACATION_TC094_END ?? "2029-11-12",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
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

  /** Mismatched pay body: ADMINISTRATIVE vacation paid with regular days */
  buildMismatchedPayBody(): Record<string, unknown> {
    return {
      regularDaysPayed: 1,
      administrativeDaysPayed: 0,
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
