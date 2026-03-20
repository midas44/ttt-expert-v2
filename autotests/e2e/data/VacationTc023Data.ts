declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-023: Create vacation with invalid notifyAlso login.
 *
 * Negative API test: POST with notifyAlso containing a non-existent login.
 * Expects: HTTP 400 from @EmployeeLoginCollectionExists validator.
 * No dynamic data needed — vacation should not be created.
 */
export class VacationTc023Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly invalidNotifyAlso: string[];
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    _mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc023Data> {
    return new VacationTc023Data();
  }

  constructor(
    login = process.env.VACATION_TC023_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC023_START ?? "2028-08-07",
    endDate = process.env.VACATION_TC023_END ?? "2028-08-11",
    invalidNotifyAlso: string[] = ["nonexistent_user_xyz_999"],
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.invalidNotifyAlso = invalidNotifyAlso;
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      notifyAlso: this.invalidNotifyAlso,
      optionalApprovers: [],
    };
  }
}
