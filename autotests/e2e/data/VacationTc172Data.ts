declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";

/**
 * Test data for TC-VAC-172: Past-date validation error — raw key in API response.
 *
 * Tests that creating a vacation with startDate in the past returns a specific
 * validation error key. The frontend displays this key as-is (no translation).
 *
 * Vault ref: modules/vacation-service-deep-dive § Validation,
 *            exploration/api-findings/vacation-crud-api-testing
 */
export class VacationTc172Data {
  readonly login: string;
  readonly pastStartDate: string;
  readonly pastEndDate: string;
  readonly paymentType = "REGULAR";
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    _tttConfig: TttConfig,
  ): Promise<VacationTc172Data> {
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');
    return new VacationTc172Data();
  }

  constructor(
    login = process.env.VACATION_TC172_LOGIN ?? "pvaynmaster",
  ) {
    this.login = login;

    // Use yesterday as the past date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = toIso(yesterday);

    this.pastStartDate = yd;
    this.pastEndDate = yd;
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.pastStartDate,
      endDate: this.pastEndDate,
      paymentType: this.paymentType,
      paymentMonth: this.pastStartDate.slice(0, 7) + "-01",
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  /** Build a body with reversed dates (start > end) to trigger dates.order validation. */
  buildReversedDatesBody(): Record<string, unknown> {
    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() + 30);
    const futureEnd = new Date();
    futureEnd.setDate(futureEnd.getDate() + 20);
    return {
      login: this.login,
      startDate: toIso(futureStart),
      endDate: toIso(futureEnd),
      paymentType: this.paymentType,
      paymentMonth: toIso(futureStart).slice(0, 7) + "-01",
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
