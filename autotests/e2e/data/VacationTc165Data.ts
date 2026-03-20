declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-165: Edit multi-year vacation — redistribution recalculates.
 *
 * Creates a cross-year vacation (Dec→Jan), records distribution,
 * then updates it to end in December (shorter), verifying distribution is recalculated.
 * Tests VacationRecalculationServiceImpl behavior on update.
 */
export class VacationTc165Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDateOriginal: string;
  readonly endDateShortened: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc165Data> {
    if (mode === "static") return new VacationTc165Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const dates = await VacationTc165Data.findCrossYearRange(db, login);
      return new VacationTc165Data(
        login,
        dates.startDate,
        dates.endDateOriginal,
        dates.endDateShortened,
      );
    } finally {
      await db.close();
    }
  }

  /**
   * Find a conflict-free Dec 18 → Jan 5 range (cross-year),
   * with a shortened variant ending Dec 24 (single-year).
   * Tries years 2035, 2036, 2037 to avoid collision with TC-164.
   */
  private static async findCrossYearRange(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; endDateOriginal: string; endDateShortened: string }> {
    const candidateYears = [2035, 2036, 2037];

    for (const year of candidateYears) {
      const start = `${year}-12-18`;
      const endOriginal = `${year + 1}-01-05`;
      const endShortened = `${year}-12-24`;

      const conflict = await hasVacationConflict(db, login, start, endOriginal);
      if (!conflict) {
        return { startDate: start, endDateOriginal: endOriginal, endDateShortened: endShortened };
      }
    }
    throw new Error(
      `No conflict-free cross-year range found for "${login}" across candidate years 2035-2037`,
    );
  }

  constructor(
    login = process.env.VACATION_TC165_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC165_START ?? "2035-12-18",
    endDateOriginal = process.env.VACATION_TC165_END_ORIG ?? "2036-01-05",
    endDateShortened = process.env.VACATION_TC165_END_SHORT ?? "2035-12-24",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDateOriginal = endDateOriginal;
    this.endDateShortened = endDateShortened;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDateOriginal,
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
      startDate: this.startDate,
      endDate: this.endDateShortened,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }
}
