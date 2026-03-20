declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-164: FIFO redistribution across year boundary.
 *
 * Creates a longer cross-year vacation (Dec 15 → Jan 9, ~13 working days)
 * to verify FIFO day distribution across years and balance updates.
 * pvaynmaster is in AV=true office (Персей, office_id=20).
 */
export class VacationTc164Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly availableDaysEndpoint = "/api/vacation/v1/vacationdays/available";
  readonly vacationDaysEndpoint = "/api/vacation/v1/vacationdays";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc164Data> {
    if (mode === "static") return new VacationTc164Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc164Data.findCrossYearRange(db, login);
      return new VacationTc164Data(login, startDate, endDate);
    } finally {
      await db.close();
    }
  }

  /**
   * Find a conflict-free Dec 15 → Jan 9 range spanning a year boundary.
   * Tries years 2032, 2033, 2034 to avoid collision with TC-084 ranges.
   */
  private static async findCrossYearRange(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; endDate: string }> {
    const candidateYears = [2032, 2033, 2034];

    for (const year of candidateYears) {
      const start = `${year}-12-15`;
      const end = `${year + 1}-01-09`;

      const conflict = await hasVacationConflict(db, login, start, end);
      if (!conflict) {
        return { startDate: start, endDate: end };
      }
    }
    throw new Error(
      `No conflict-free cross-year range found for "${login}" across candidate years 2032-2034`,
    );
  }

  constructor(
    login = process.env.VACATION_TC164_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC164_START ?? "2032-12-15",
    endDate = process.env.VACATION_TC164_END ?? "2033-01-09",
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

  get startYear(): number {
    return parseInt(this.startDate.slice(0, 4), 10);
  }

  get endYear(): number {
    return parseInt(this.endDate.slice(0, 4), 10);
  }
}
