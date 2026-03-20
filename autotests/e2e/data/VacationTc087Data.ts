declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-087: Days by years endpoint verification.
 *
 * GET endpoint test: /api/vacation/v1/vacationdays/{login}/years
 * Returns per-year breakdown of vacation day balance.
 * Cross-checks with employee_vacation table in DB.
 */
export class VacationTc087Data {
  readonly employeeLogin: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationDaysEndpoint = "/api/vacation/v1/vacationdays";

  constructor(
    employeeLogin = process.env.VACATION_TC087_LOGIN ?? "pvaynmaster",
  ) {
    this.employeeLogin = employeeLogin;
  }

  buildEndpointPath(): string {
    return `${this.vacationDaysEndpoint}/${encodeURIComponent(this.employeeLogin)}/years`;
  }
}
