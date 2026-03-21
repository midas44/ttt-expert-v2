declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-161: AV=true availablePaidDays after cross-year vacation.
 *
 * MR !5169 fixed VacationEventsModal.js and UserVacationsPage.js to display
 * `availablePaidDays` instead of `currentYear`. This test creates a cross-year
 * vacation (Dec→Jan) and verifies the API returns correct availablePaidDays
 * that differs from the currentYear field when redistribution occurs.
 */
export class VacationTc161Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly vacationDaysEndpoint = "/api/vacation/v1/vacationdays";
  readonly availableDaysEndpoint = "/api/vacation/v1/vacationdays/available";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc161Data> {
    if (mode === "static") return new VacationTc161Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      // Find conflict-free cross-year window (Dec→Jan) in far future
      const { startDate, endDate } =
        await VacationTc161Data.findCrossYearWindow(db, login);
      return new VacationTc161Data(login, startDate, endDate);
    } finally {
      await db.close();
    }
  }

  private static async findCrossYearWindow(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; endDate: string }> {
    // Try Dec→Jan windows in successive far-future years
    for (let baseYear = 2037; baseYear <= 2042; baseYear++) {
      const start = `${baseYear}-12-22`;
      const end = `${baseYear + 1}-01-09`;

      const conflict = await hasVacationConflict(db, login, start, end);
      if (!conflict) {
        return { startDate: start, endDate: end };
      }
    }
    throw new Error(`No conflict-free cross-year window found for "${login}"`);
  }

  constructor(
    login = process.env.VACATION_TC161_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC161_START ?? "2037-12-22",
    endDate = process.env.VACATION_TC161_END ?? "2038-01-09",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    // Payment month = January of the end year (next year)
    this.paymentMonth = endDate.slice(0, 7) + "-01";
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
}
