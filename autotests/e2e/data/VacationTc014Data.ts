declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-014: Create with null paymentMonth — NPE bug.
 *
 * API test: POST /api/vacation/v1/vacations with paymentMonth omitted.
 * KNOWN BUG: HTTP 500 NullPointerException at VacationAvailablePaidDaysCalculatorImpl:73
 * paymentDate.getYear() NPE — DTO lacks @NotNull on paymentMonth field.
 */
export class VacationTc014Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc014Data> {
    if (mode === "static") return new VacationTc014Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // No DB needed — the request will fail due to null paymentMonth NPE
    // Use far-future dates to avoid crossing conflicts
    return new VacationTc014Data("pvaynmaster", "2028-06-05", "2028-06-09");
  }

  constructor(
    login = process.env.VACATION_TC014_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC014_START ?? "2028-06-05",
    endDate = process.env.VACATION_TC014_END ?? "2028-06-09",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
  }

  /** Build create body WITHOUT paymentMonth — triggers NPE */
  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      // paymentMonth intentionally omitted — triggers NPE bug
      optionalApprovers: [],
      notifyAlso: [],
    };
  }
}
