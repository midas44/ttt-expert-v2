declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-012: Create next-year vacation on/after Feb 1.
 *
 * API test: POST /api/vacation/v1/vacations with startDate in next year.
 * When current date >= Feb 1, the nextYearAvailableFromMonth restriction is lifted.
 * Expects: 200 (created) or 400 with error OTHER than "validation.vacation.next.year.not.available".
 * Key assertion: the next-year block is NOT triggered.
 */
export class VacationTc012Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly nextYearBlockedErrorCode = "validation.vacation.next.year.not.available";

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc012Data> {
    if (mode === "static") return new VacationTc012Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // Dynamic: calculate next year from current date
    const now = new Date();
    const nextYear = now.getFullYear() + 1;
    // Use March of next year — safe Mon-Fri range
    const startDate = `${nextYear}-03-10`;
    const endDate = `${nextYear}-03-14`;
    return new VacationTc012Data("pvaynmaster", startDate, endDate);
  }

  constructor(
    login = process.env.VACATION_TC012_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC012_START ?? "2027-03-08",
    endDate = process.env.VACATION_TC012_END ?? "2027-03-12",
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
}
