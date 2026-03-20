declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-084: Cross-year vacation — days split across years.
 *
 * Creates vacation spanning Dec→Jan to verify vacation_days_distribution
 * correctly splits working days between the two calendar years.
 * FIFO: current year days consumed first.
 */
export class VacationTc084Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc084Data> {
    if (mode === "static") return new VacationTc084Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc084Data.findCrossYearRange(db, login);
      return new VacationTc084Data(login, startDate, endDate);
    } finally {
      await db.close();
    }
  }

  /**
   * Find a conflict-free date range crossing a year boundary.
   * Tries Dec 29 → Jan 2 for years 2029, 2030, 2031.
   */
  private static async findCrossYearRange(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; endDate: string }> {
    const candidateYears = [2029, 2030, 2031];

    for (const year of candidateYears) {
      // Use Dec 29 to Jan 2 as the cross-year range
      // This ensures at least 1-2 working days in each year
      const start = `${year}-12-29`;
      const end = `${year + 1}-01-02`;

      const conflict = await hasVacationConflict(db, login, start, end);
      if (!conflict) {
        return { startDate: start, endDate: end };
      }
    }
    throw new Error(
      `No conflict-free cross-year range found for "${login}" across candidate years`,
    );
  }

  constructor(
    login = process.env.VACATION_TC084_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC084_START ?? "2029-12-29",
    endDate = process.env.VACATION_TC084_END ?? "2030-01-02",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    // paymentMonth should be in the start year
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

  /** Extract the two years this vacation spans */
  get startYear(): number {
    return parseInt(this.startDate.slice(0, 4), 10);
  }

  get endYear(): number {
    return parseInt(this.endDate.slice(0, 4), 10);
  }
}

