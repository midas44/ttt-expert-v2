declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-076: FIFO cancel returns days to pool, redistributes.
 *
 * Creates two vacations (A + B), cancels A, verifies:
 * - A's days returned to employee_vacation balance
 * - B's vacation_days_distribution may change (comprehensive FIFO recalculation)
 * Vault ref: patterns/vacation-day-calculation § FIFO Day Consumption
 */
export class VacationTc076Data {
  readonly login: string;
  readonly startDateA: string;
  readonly endDateA: string;
  readonly startDateB: string;
  readonly endDateB: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonthA: string;
  readonly paymentMonthB: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly vacationDaysEndpoint = "/api/vacation/v1/vacationdays";
  readonly cancelEndpoint = "/api/vacation/v1/vacations/cancel";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc076Data> {
    if (mode === "static") return new VacationTc076Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const weekA = await VacationTc076Data.findAvailableWeek(db, login, 263);
      const weekB = await VacationTc076Data.findAvailableWeek(db, login, 266);
      return new VacationTc076Data(
        login,
        weekA.startDate, weekA.endDate,
        weekB.startDate, weekB.endDate,
      );
    } finally {
      await db.close();
    }
  }

  private static async findAvailableWeek(
    db: DbClient,
    login: string,
    startWeekOffset: number,
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
      `No conflict-free week for "${login}" from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC076_LOGIN ?? "pvaynmaster",
    startDateA = process.env.VACATION_TC076_START_A ?? "2031-04-07",
    endDateA = process.env.VACATION_TC076_END_A ?? "2031-04-11",
    startDateB = process.env.VACATION_TC076_START_B ?? "2031-04-28",
    endDateB = process.env.VACATION_TC076_END_B ?? "2031-05-02",
  ) {
    this.login = login;
    this.startDateA = startDateA;
    this.endDateA = endDateA;
    this.startDateB = startDateB;
    this.endDateB = endDateB;
    this.paymentMonthA = startDateA.slice(0, 7) + "-01";
    this.paymentMonthB = startDateB.slice(0, 7) + "-01";
  }

  buildCreateBodyA(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDateA,
      endDate: this.endDateA,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonthA,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  buildCreateBodyB(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDateB,
      endDate: this.endDateB,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonthB,
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
