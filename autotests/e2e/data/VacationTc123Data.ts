declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-123: Type mismatch — string for numeric field.
 *
 * API test: GET /vacations/abc (string instead of numeric ID).
 * MethodArgumentTypeMismatchException → 400 with errorCode: exception.type.mismatch
 */
export class VacationTc123Data {
  readonly stringId: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  constructor(
    stringId = process.env.VACATION_TC123_STRING_ID ?? "abc",
  ) {
    this.stringId = stringId;
  }
}
