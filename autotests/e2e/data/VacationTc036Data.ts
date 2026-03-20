declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-036: Update non-existing vacation ID.
 *
 * API test: PUT /api/vacation/v1/vacations/999999999 with valid body.
 * Expects: 404 (EntityNotFoundException from VacationRepository).
 */
export class VacationTc036Data {
  readonly login: string;
  readonly nonExistentId: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc036Data> {
    if (mode === "static") return new VacationTc036Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    return new VacationTc036Data();
  }

  constructor(
    login = process.env.VACATION_TC036_LOGIN ?? "pvaynmaster",
    nonExistentId = 999999999,
    startDate = process.env.VACATION_TC036_START ?? "2028-11-06",
    endDate = process.env.VACATION_TC036_END ?? "2028-11-10",
  ) {
    this.login = login;
    this.nonExistentId = nonExistentId;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
  }

  buildUpdateBody(): Record<string, unknown> {
    return {
      id: this.nonExistentId,
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
