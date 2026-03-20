declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-083: Available days — negative newDays accepted (bug).
 *
 * Read-only API test: GET /vacationdays/available with newDays=-5.
 * BUG: No @Min annotation on newDays parameter — negative values return valid response.
 * Expected: should reject non-positive values. Actual: returns availablePaidDays without error.
 */
export class VacationTc083Data {
  readonly login: string;
  readonly paymentDate: string;
  readonly negativeNewDays: number;
  readonly zeroNewDays: number;
  readonly positiveNewDays: number;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly availableDaysEndpoint = "/api/vacation/v1/vacationdays/available";

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc083Data> {
    return new VacationTc083Data();
  }

  constructor(
    login = process.env.VACATION_TC083_LOGIN ?? "pvaynmaster",
    paymentDate = process.env.VACATION_TC083_PAYMENT_DATE ?? "2027-06-01",
  ) {
    this.login = login;
    this.paymentDate = paymentDate;
    this.negativeNewDays = -5;
    this.zeroNewDays = 0;
    this.positiveNewDays = 5;
  }

  buildUrl(baseUrl: string, newDays: number): string {
    return `${baseUrl}?employeeLogin=${this.login}&paymentDate=${this.paymentDate}&newDays=${newDays}`;
  }
}
