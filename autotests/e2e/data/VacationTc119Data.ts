declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-119: Malformed JSON request body — empty 400 response.
 *
 * API test: POST invalid JSON to vacation create endpoint.
 * HttpMessageNotReadableException handler returns ResponseEntity<Void> — empty body.
 */
export class VacationTc119Data {
  readonly malformedJson: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  constructor(
    malformedJson = process.env.VACATION_TC119_MALFORMED ?? '{invalid json, "broken": }',
  ) {
    this.malformedJson = malformedJson;
  }
}
