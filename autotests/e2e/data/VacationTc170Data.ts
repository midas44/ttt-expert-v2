declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";

/**
 * Test data for TC-VAC-170: Past start date + end before start — both validation errors returned.
 *
 * VacationCreateValidator.isStartEndDatesCorrect() checks BOTH conditions in a single pass:
 *   1. startDate < today → validation.vacation.start.date.in.past
 *   2. startDate > endDate → validation.vacation.dates.order
 * Both violations are collected before returning false.
 * Subsequent validators (duration, next-year) are short-circuited via && operator.
 */
export class VacationTc170Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  readonly expectedErrorCode = "exception.validation";
  readonly expectedViolations = [
    "validation.vacation.start.date.in.past",
    "validation.vacation.dates.order",
  ];

  static async create(
    mode: TestDataMode,
  ): Promise<VacationTc170Data> {
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // Compute past start date (5 days ago) and end date before start (10 days ago)
    const now = new Date();
    const pastStart = new Date(now);
    pastStart.setDate(now.getDate() - 5);
    const endBeforeStart = new Date(now);
    endBeforeStart.setDate(now.getDate() - 10);

    return new VacationTc170Data(
      "pvaynmaster",
      toIso(pastStart),
      toIso(endBeforeStart),
    );
  }

  constructor(
    login = process.env.VACATION_TC170_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC170_START ?? "2026-03-10",
    endDate = process.env.VACATION_TC170_END ?? "2026-03-05",
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

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
