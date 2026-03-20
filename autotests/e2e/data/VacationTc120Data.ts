declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-120: Invalid date format — stack trace / info leakage.
 *
 * API test: GET paymentdates with an invalid date (month=13).
 * Expects: 400 with Spring exception class names in response (information disclosure).
 */
export class VacationTc120Data {
  readonly paymentDatesEndpoint: string;
  readonly invalidStartDate: string;
  readonly validEndDate: string;
  readonly authHeaderName = "API_SECRET_TOKEN";

  constructor(
    invalidStartDate = process.env.VACATION_TC120_BAD_DATE ?? "2026-13-01",
    validEndDate = process.env.VACATION_TC120_END ?? "2026-04-01",
  ) {
    this.invalidStartDate = invalidStartDate;
    this.validEndDate = validEndDate;
    this.paymentDatesEndpoint = `/api/vacation/v1/paymentdates?vacationStartDate=${this.invalidStartDate}&vacationEndDate=${this.validEndDate}`;
  }
}
