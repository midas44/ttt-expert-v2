declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-154: Vacation days carry-over — verify no expiration (burnOff unused).
 *
 * Read-only test verifying that vacation days from old years never expire.
 * CSSalaryOfficeVacationData.burnOff exists in CS model but is NOT synced or used in TTT.
 * Days accumulate indefinitely across years in employee_vacation table.
 */
export class VacationTc154Data {
  readonly login: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationDaysEndpoint = "/api/vacation/v1/vacationdays";
  readonly availableDaysEndpoint = "/api/vacation/v1/vacationdays/available";

  constructor(
    login = process.env.VACATION_TC154_LOGIN ?? "pvaynmaster",
  ) {
    this.login = login;
  }
}
