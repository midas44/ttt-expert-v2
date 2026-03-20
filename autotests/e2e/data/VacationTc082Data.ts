declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-082: Available days endpoint — newDays=0 (main page mode).
 *
 * GET endpoint test: newDays=0 triggers binary search algorithm that calculates
 * maximum safe vacation duration. Returns availablePaidDays as max days available.
 */
export class VacationTc082Data {
  readonly employeeLogin: string;
  readonly paymentDate: string;
  readonly newDays = 0;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly availableDaysEndpoint = "/api/vacation/v1/vacationdays/available";

  constructor(
    employeeLogin = process.env.VACATION_TC082_LOGIN ?? "pvaynmaster",
    paymentDate = process.env.VACATION_TC082_PAYMENT_DATE ?? "2029-01-01",
  ) {
    this.employeeLogin = employeeLogin;
    this.paymentDate = paymentDate;
  }

  buildQueryString(): string {
    return `employeeLogin=${encodeURIComponent(this.employeeLogin)}&paymentDate=${this.paymentDate}&newDays=${this.newDays}`;
  }
}
