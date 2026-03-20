declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-032: Update with overlapping dates.
 *
 * API validation test: Create two vacations A and B (non-overlapping),
 * then update B's dates to overlap with A.
 * Expects: HTTP 400 with exception.validation.vacation.dates.crossing.
 * Crossing check excludes the vacation being updated (self), but catches other overlaps.
 */
export class VacationTc032Data {
  readonly login: string;
  readonly vacationAStart: string;
  readonly vacationAEnd: string;
  readonly vacationBStart: string;
  readonly vacationBEnd: string;
  readonly paymentType = "REGULAR";
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc032Data> {
    if (mode === "static") return new VacationTc032Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const weekA = await VacationTc032Data.findAvailableWeek(db, login, 128);
      const weekB = await VacationTc032Data.findAvailableWeek(db, login, 132);
      return new VacationTc032Data(
        login,
        weekA.startDate,
        weekA.endDate,
        weekB.startDate,
        weekB.endDate,
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
    login = process.env.VACATION_TC032_LOGIN ?? "pvaynmaster",
    vacationAStart = process.env.VACATION_TC032_A_START ?? "2028-10-02",
    vacationAEnd = process.env.VACATION_TC032_A_END ?? "2028-10-06",
    vacationBStart = process.env.VACATION_TC032_B_START ?? "2028-11-06",
    vacationBEnd = process.env.VACATION_TC032_B_END ?? "2028-11-10",
  ) {
    this.login = login;
    this.vacationAStart = vacationAStart;
    this.vacationAEnd = vacationAEnd;
    this.vacationBStart = vacationBStart;
    this.vacationBEnd = vacationBEnd;
  }

  buildCreateBodyA(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.vacationAStart,
      endDate: this.vacationAEnd,
      paymentType: this.paymentType,
      paymentMonth: this.vacationAStart.slice(0, 7) + "-01",
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  buildCreateBodyB(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.vacationBStart,
      endDate: this.vacationBEnd,
      paymentType: this.paymentType,
      paymentMonth: this.vacationBStart.slice(0, 7) + "-01",
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  /** Update B's dates to exactly match A — guaranteed overlap */
  buildOverlapUpdateBody(vacationBId: number): Record<string, unknown> {
    return {
      id: vacationBId,
      login: this.login,
      startDate: this.vacationAStart,
      endDate: this.vacationAEnd,
      paymentType: this.paymentType,
      paymentMonth: this.vacationAStart.slice(0, 7) + "-01",
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
