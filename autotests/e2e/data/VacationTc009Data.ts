declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeAvFalse } from "./queries/vacationApiQueries";

/**
 * Test data for TC-VAC-009: Create with insufficient available days (AV=false).
 *
 * API test: POST /api/vacation/v1/vacations with REGULAR type spanning ~777 working days.
 * Employee in AV=false office — accrued days based on monthly formula, always << 777.
 * Expects: 400, errorCode containing "validation.vacation.duration"
 */
export class VacationTc009Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly expectedErrorCode = "validation.vacation.duration";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc009Data> {
    if (mode === "static") return new VacationTc009Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // Dynamic: find an AV=false employee via DB
    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeAvFalse(db);
      return new VacationTc009Data(emp.login, "2028-08-07", "2031-07-25");
    } finally {
      await db.close();
    }
  }

  constructor(
    login = process.env.VACATION_TC009_LOGIN ?? "slebedev",
    startDate = process.env.VACATION_TC009_START ?? "2028-08-07",
    endDate = process.env.VACATION_TC009_END ?? "2031-07-25",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
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
