declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-128: Very large vacation — 365 day boundary.
 *
 * API test: POST create spanning entire year (365 days REGULAR type).
 * Expected to fail: insufficient available days (pvaynmaster has ~28 days).
 * Also tests ADMINISTRATIVE type which has no day limit check.
 * DTO @Range(min=0, max=366) on payment fields accommodates leap years.
 */
export class VacationTc128Data {
  readonly login: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  constructor(
    login = process.env.VACATION_TC128_LOGIN ?? "pvaynmaster",
  ) {
    this.login = login;
  }

  /** 365-day REGULAR vacation — expected to fail with insufficient days */
  buildLargeRegularBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: "2032-01-05",
      endDate: "2032-12-31",
      paymentType: "REGULAR",
      paymentMonth: "2032-01-01",
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  /** 365-day ADMINISTRATIVE vacation — no day limit check, may succeed */
  buildLargeAdministrativeBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: "2033-01-03",
      endDate: "2033-12-30",
      paymentType: "ADMINISTRATIVE",
      paymentMonth: "2033-01-01",
      optionalApprovers: [],
      notifyAlso: [],
    };
  }
}
