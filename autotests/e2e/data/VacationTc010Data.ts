declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-010: Create with insufficient available days (AV=true).
 *
 * API test: POST /api/vacation/v1/vacations with REGULAR type spanning ~777 working days.
 * pvaynmaster (AV=true, 24 days/year, large accumulated carryover ~153+ days).
 * Uses 3-year span to definitively exceed available balance.
 * Expects: 400, errorCode containing "validation.vacation.duration"
 */
export class VacationTc010Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly expectedErrorCode = "validation.vacation.duration";

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc010Data> {
    if (mode === "static") return new VacationTc010Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // No DB needed — vacation create will be rejected by validator
    // 3-year span (Apr 2027 → Mar 2030) = ~777 working days, exceeds any AV=true balance
    return new VacationTc010Data("pvaynmaster", "2027-04-07", "2030-03-27");
  }

  constructor(
    login = process.env.VACATION_TC010_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC010_START ?? "2027-04-07",
    endDate = process.env.VACATION_TC010_END ?? "2030-03-27",
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
