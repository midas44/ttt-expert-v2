declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { findEmployeeAvFalse } from "./queries/vacationApiQueries";

/**
 * Test data for TC-VAC-069: AV=false basic accrual formula — mid-year calculation.
 *
 * Finds an AV=false employee to verify the RegularCalculationStrategy formula:
 * accruedDays = paymentMonth × (normDays / 12).
 * AV=false clamps negative result to 0.
 */
export class VacationTc069Data {
  readonly login: string;
  readonly officeId: number;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationDaysEndpoint = "/api/vacation/v1/vacationdays";
  readonly availableDaysEndpoint = "/api/vacation/v1/vacationdays/available";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc069Data> {
    if (mode === "static") return new VacationTc069Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeAvFalse(db, 0);
      return new VacationTc069Data(emp.login, emp.office_id);
    } finally {
      await db.close();
    }
  }

  constructor(
    login = process.env.VACATION_TC069_LOGIN ?? "abaymaganov",
    officeId = Number(process.env.VACATION_TC069_OFFICE_ID ?? "1"),
  ) {
    this.login = login;
    this.officeId = officeId;
  }
}
