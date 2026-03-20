declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-127: Empty request body — 400 response.
 *
 * API test: POST with no body to vacation create endpoint.
 * HttpMessageNotReadableException handler returns ResponseEntity<Void> — empty body.
 * Same behavior as malformed JSON (TC-119).
 */
export class VacationTc127Data {
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
}
