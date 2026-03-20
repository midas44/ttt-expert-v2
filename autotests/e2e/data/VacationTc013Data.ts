declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-013: Create overlapping vacation (start inside existing).
 *
 * API test: Create vacation A, then POST vacation B with startDate inside A's range.
 * Expects: 400, errorCode = exception.validation.vacation.dates.crossing
 */
export class VacationTc013Data {
  readonly login: string;
  /** Vacation A — the "existing" vacation (will be created first) */
  readonly startDateA: string;
  readonly endDateA: string;
  /** Vacation B — overlapping (start inside A's range, extends beyond) */
  readonly startDateB: string;
  readonly endDateB: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonthA: string;
  readonly paymentMonthB: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly expectedErrorCode = "exception.validation.vacation.dates.crossing";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc013Data> {
    if (mode === "static") return new VacationTc013Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc013Data.findAvailableWeek(db, login, 54);
      // Vacation B starts on Wednesday of the same week (inside A's Mon-Fri range)
      // and extends to the following Friday
      const startA = new Date(startDate);
      const startB = new Date(startA);
      startB.setDate(startA.getDate() + 2); // Wednesday
      const endB = new Date(startA);
      endB.setDate(startA.getDate() + 11); // Friday of next week

      return new VacationTc013Data(
        login,
        startDate,
        endDate,
        toIso(startB),
        toIso(endB),
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
      end.setDate(start.getDate() + 11); // Need 2 weeks clear for overlap test

      const startIso = toIso(start);
      const endIso = toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        // Return just the first week as vacation A
        const endA = new Date(start);
        endA.setDate(start.getDate() + 4); // Friday
        return { startDate: startIso, endDate: toIso(endA) };
      }
    }
    throw new Error(
      `No conflict-free 2-week window for "${login}" within 12 attempts`,
    );
  }

  constructor(
    login = process.env.VACATION_TC013_LOGIN ?? "pvaynmaster",
    startDateA = process.env.VACATION_TC013_START_A ?? "2027-04-05",
    endDateA = process.env.VACATION_TC013_END_A ?? "2027-04-09",
    startDateB = process.env.VACATION_TC013_START_B ?? "2027-04-07",
    endDateB = process.env.VACATION_TC013_END_B ?? "2027-04-16",
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
