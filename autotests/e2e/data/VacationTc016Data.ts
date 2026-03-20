declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-016: Create with non-existent employee login.
 *
 * API test: POST /api/vacation/v1/vacations with login that doesn't exist.
 * The @EmployeeLoginExists annotation on the DTO login field triggers validation.
 * Expects: 400 with EmployeeLoginExists constraint violation error.
 */
export class VacationTc016Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc016Data> {
    if (mode === "static") return new VacationTc016Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // No DB needed — using a login guaranteed not to exist
    return new VacationTc016Data();
  }

  constructor(
    login = process.env.VACATION_TC016_LOGIN ?? "nonexistent_user_xyz_98765",
    startDate = process.env.VACATION_TC016_START ?? "2028-10-02",
    endDate = process.env.VACATION_TC016_END ?? "2028-10-06",
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
