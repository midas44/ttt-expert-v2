declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

interface AvTrueEmployeeRow {
  login: string;
  office_name: string;
}

/**
 * TC-VAC-057: Verify available days for AV=true employee (full year).
 * Finds an employee in an AV=true office. The test itself fetches the
 * expected value from the vacation API (availablePaidDays) for comparison.
 */
export class VacationTc057Data {
  readonly username: string;
  readonly officeName: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc057Data> {
    if (mode === "static") return new VacationTc057Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<AvTrueEmployeeRow>(
        `SELECT e.login,
                o.name AS office_name
         FROM ttt_vacation.employee e
         JOIN ttt_vacation.office o ON e.office_id = o.id
         JOIN ttt_vacation.employee_vacation ev ON e.id = ev.employee
         WHERE o.advance_vacation = true
           AND e.enabled = true
           AND ev.year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND ev.available_vacation_days > 0
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc057Data(row.login, row.office_name);
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC057_USERNAME ?? "okanunnikau",
    officeName = "Venera",
  ) {
    this.username = username;
    this.officeName = officeName;
  }
}
