declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-004: Create vacation with start date in past.
 *
 * API test: POST /api/vacation/v1/vacations with yesterday as startDate.
 * Expects: HTTP 400, errorCode: validation.vacation.start.date.in.past
 */
export class VacationTc004Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly expectedStatus = 400;
  readonly expectedErrorCode = "validation.vacation.start.date.in.past";

  static async create(
    _mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc004Data> {
    // Always compute dates dynamically relative to today
    return new VacationTc004Data("pvaynmaster");
  }

  constructor(
    login = process.env.VACATION_TC004_LOGIN ?? "pvaynmaster",
  ) {
    this.login = login;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    this.startDate = toIso(yesterday);
    this.endDate = toIso(nextWeek);
    this.paymentMonth = this.endDate.slice(0, 7) + "-01";
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

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
