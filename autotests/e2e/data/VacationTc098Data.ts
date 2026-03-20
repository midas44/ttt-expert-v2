declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-098: Payment dates with start > end — accepted (bug).
 *
 * GET /api/vacation/v1/paymentdates?vacationStartDate=X&vacationEndDate=Y
 * BUG: Inverted date range (start > end) returns valid results instead of 400.
 * No validation that vacationStartDate <= vacationEndDate.
 */
export class VacationTc098Data {
  /** Normal (valid) range for baseline comparison */
  readonly normalStartDate: string;
  readonly normalEndDate: string;
  /** Inverted (invalid) range — start > end */
  readonly invertedStartDate: string;
  readonly invertedEndDate: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly paymentDatesEndpoint = "/api/vacation/v1/paymentdates";

  constructor(
    normalStartDate = process.env.VACATION_TC098_START ?? "2027-06-01",
    normalEndDate = process.env.VACATION_TC098_END ?? "2027-06-10",
  ) {
    this.normalStartDate = normalStartDate;
    this.normalEndDate = normalEndDate;
    // Inverted: swap start/end
    this.invertedStartDate = normalEndDate;
    this.invertedEndDate = normalStartDate;
  }

  buildNormalUrl(): string {
    return `${this.paymentDatesEndpoint}?vacationStartDate=${this.normalStartDate}&vacationEndDate=${this.normalEndDate}`;
  }

  buildInvertedUrl(): string {
    return `${this.paymentDatesEndpoint}?vacationStartDate=${this.invertedStartDate}&vacationEndDate=${this.invertedEndDate}`;
  }
}
