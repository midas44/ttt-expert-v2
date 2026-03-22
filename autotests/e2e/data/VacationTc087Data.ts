declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-087: Overlapping vacation dates — crossing error.
 * Finds an employee with an existing future Mon-Fri vacation,
 * then creates overlap dates that are frontend-valid (future, start < end, weekdays).
 * The backend should reject with crossing validation error.
 */
export class VacationTc087Data {
  readonly username: string;
  readonly startDate: string; // dd.mm.yyyy — overlaps with existing vacation
  readonly endDate: string;   // dd.mm.yyyy — overlaps with existing vacation
  readonly existingPeriod: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc087Data> {
    if (mode === "static") return new VacationTc087Data();

    const db = new DbClient(tttConfig);
    try {
      // Find an employee with a future vacation spanning weekdays (Mon-Fri style)
      const row = await db.queryOne<{
        login: string;
        start_date: string;
        end_date: string;
      }>(
        `SELECT e.login, v.start_date::text, v.end_date::text
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         WHERE v.status IN ('NEW', 'APPROVED')
           AND v.start_date > CURRENT_DATE + INTERVAL '7 days'
           AND v.end_date - v.start_date >= 2
           AND e.enabled = true
         ORDER BY random()
         LIMIT 1`,
      );

      // Create overlapping dates: use the SAME date range as the existing vacation.
      // This guarantees frontend-valid dates (future, start < end) that definitely overlap.
      const existStart = new Date(row.start_date);
      const existEnd = new Date(row.end_date);

      return new VacationTc087Data(
        row.login,
        VacationTc087Data.toDdMmYyyy(existStart),
        VacationTc087Data.toDdMmYyyy(existEnd),
        `${row.start_date} to ${row.end_date}`,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC087_USERNAME ?? "pvaynmaster",
    startDate = "13.04.2026",
    endDate = "17.04.2026",
    existingPeriod = "13.04.2026 to 17.04.2026",
  ) {
    this.username = username;
    this.startDate = startDate;
    this.endDate = endDate;
    this.existingPeriod = existingPeriod;
  }

  private static toDdMmYyyy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }
}
