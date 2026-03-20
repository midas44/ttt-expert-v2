declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-124: Exception class leakage in error responses.
 *
 * API test: Trigger a ServiceException and verify that the `exception` field
 * contains full Java class name (e.g. com.noveogroup.ttt.common.exception.ServiceException).
 * This is an information disclosure vulnerability.
 *
 * We trigger the error by posting a vacation with past dates (start date in the past).
 */
export class VacationTc124Data {
  readonly login: string;
  readonly pastStartDate: string;
  readonly pastEndDate: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  constructor(
    login = process.env.VACATION_TC124_LOGIN ?? "pvaynmaster",
    pastStartDate = process.env.VACATION_TC124_START ?? "2020-01-06",
    pastEndDate = process.env.VACATION_TC124_END ?? "2020-01-10",
  ) {
    this.login = login;
    this.pastStartDate = pastStartDate;
    this.pastEndDate = pastEndDate;
  }

  /** Body with past dates — triggers ServiceException (validation.vacation.start.date.in.past) */
  buildPastDateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.pastStartDate,
      endDate: this.pastEndDate,
      paymentType: "REGULAR",
      paymentMonth: this.pastStartDate.slice(0, 7) + "-01",
      optionalApprovers: [],
      notifyAlso: [],
    };
  }
}
