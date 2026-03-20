declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-097: Payment dates endpoint — valid range.
 *
 * GET /api/vacation/v1/paymentdates?vacationStartDate=X&vacationEndDate=Y
 * Returns array of 1st-of-month date strings for the payment month dropdown.
 * Range: (vacStart - 2 months) to (vacEnd + 6 months), bounded by report period.
 */
export class VacationTc097Data {
  readonly vacationStartDate: string;
  readonly vacationEndDate: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly paymentDatesEndpoint = "/api/vacation/v1/paymentdates";

  constructor(
    vacationStartDate = process.env.VACATION_TC097_START ?? "2027-04-01",
    vacationEndDate = process.env.VACATION_TC097_END ?? "2027-04-10",
  ) {
    this.vacationStartDate = vacationStartDate;
    this.vacationEndDate = vacationEndDate;
  }

  buildEndpointUrl(): string {
    return `${this.paymentDatesEndpoint}?vacationStartDate=${this.vacationStartDate}&vacationEndDate=${this.vacationEndDate}`;
  }
}
