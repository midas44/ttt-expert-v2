declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findRandomEmployee } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-005: Create vacation with startDate > endDate.
 *
 * API test: POST /api/vacation/v1/vacations with inverted dates.
 * Expects: HTTP 400, errorCode: validation.vacation.dates.order
 */
export class VacationTc005Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly expectedStatus = 400;
  readonly expectedErrorCode = "validation.vacation.dates.order";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc005Data> {
    if (mode === "static") return new VacationTc005Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const db = new DbClient(tttConfig);
    try {
      const login = await findRandomEmployee(db);
      return new VacationTc005Data(login);
    } finally {
      await db.close();
    }
  }

  constructor(
    login = process.env.VACATION_TC005_LOGIN ?? "slebedev",
    /** startDate intentionally AFTER endDate for negative test */
    startDate = process.env.VACATION_TC005_START ?? "2026-04-10",
    endDate = process.env.VACATION_TC005_END ?? "2026-04-05",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = endDate.slice(0, 7) + "-01";
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }
}
