declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

interface AvFalseEmployeeRow {
  login: string;
  office_name: string;
}

/**
 * TC-VAC-056: Verify available days for AV=false employee (monthly accrual).
 * Finds an employee in an AV=false office. The test itself fetches the
 * expected value from the vacation API (availablePaidDays) for comparison.
 */
export class VacationTc056Data {
  readonly username: string;
  readonly officeName: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc056Data> {
    if (mode === "static") return new VacationTc056Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<AvFalseEmployeeRow>(
        `SELECT e.login,
                o.name AS office_name
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.office o ON e.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE o.advance_vacation = false
           AND e.enabled = true
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND ev.available_vacation_days > 0
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc056Data(row.login, row.office_name);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC056_USERNAME ?? "amelnikova",
    officeName = "Venera RF",
  ) {
    this.username = username;
    this.officeName = officeName;
  }
}
