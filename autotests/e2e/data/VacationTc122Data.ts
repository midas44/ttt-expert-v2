declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-122: Missing required fields — validation errors with field details.
 *
 * API test: POST vacation with only login (missing startDate, endDate, paymentType).
 * MethodArgumentNotValidException maps to 400 with errors array containing per-field violations.
 */
export class VacationTc122Data {
  readonly login: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly expectedMissingFields = ["startDate", "endDate", "paymentType"];

  constructor(
    login = process.env.VACATION_TC122_LOGIN ?? "pvaynmaster",
  ) {
    this.login = login;
  }

  /** Body with only login — all required fields omitted */
  buildIncompleteBody(): Record<string, unknown> {
    return {
      login: this.login,
    };
  }
}
