declare const process: { env: Record<string, string | undefined> };

/**
 * Test data for TC-VAC-121: Non-existent vacation ID — 404 response.
 *
 * Simple negative API test: GET with a non-existent ID returns 404.
 * Verifies EntityNotFoundException handling and clean error response.
 */
export class VacationTc121Data {
  readonly nonExistentId: number;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  constructor(
    nonExistentId = Number(process.env.VACATION_TC121_ID ?? "999999999"),
  ) {
    this.nonExistentId = nonExistentId;
  }
}
