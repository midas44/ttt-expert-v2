declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findRandomOfficeId } from "./queries/vacationApiQueries";

/**
 * Test data for TC-VAC-118: NPE on null pagination — availability-schedule endpoints.
 *
 * API test: GET /v1/availability-schedule and /v2/availability-schedule without page/pageSize.
 * Expects: KNOWN BUG — HTTP 500 NullPointerException at PageableRequestDTOToBOConverter.java:33-34.
 */
export class VacationTc118Data {
  readonly officeId: number;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly v1Endpoint = "/api/vacation/v1/availability-schedule";
  readonly v2Endpoint = "/api/vacation/v2/availability-schedule";
  /** With pagination params — should succeed */
  readonly workaroundParams = "page=0&pageSize=20";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc118Data> {
    if (mode === "static") return new VacationTc118Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const db = new DbClient(tttConfig);
    try {
      const officeId = await findRandomOfficeId(db);
      return new VacationTc118Data(officeId);
    } finally {
      await db.close();
    }
  }

  constructor(
    officeId = Number(process.env.VACATION_TC118_OFFICE ?? "1"),
  ) {
    this.officeId = officeId;
  }
}
