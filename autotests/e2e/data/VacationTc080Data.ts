declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-080: Verify permissions for NEW vacation (owner).
 * Finds an employee who owns a NEW vacation request.
 */
export class VacationTc080Data {
  readonly ownerLogin: string;
  readonly vacationPeriodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc080Data> {
    if (mode === "static") return new VacationTc080Data();

    const db = new DbClient(tttConfig);
    try {
      const row = await db.queryOne<{
        login: string;
        start_date: string;
        end_date: string;
      }>(
        `SELECT e.login,
                v.start_date::text AS start_date,
                v.end_date::text AS end_date
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         WHERE v.status = 'NEW'
           AND e.enabled = true
           AND v.start_date > CURRENT_DATE
         ORDER BY random()
         LIMIT 1`,
      );
      return new VacationTc080Data(
        row.login,
        VacationTc080Data.buildPattern(row.start_date, row.end_date),
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    ownerLogin = process.env.VACATION_TC080_USERNAME ?? "dvovney",
    vacationPeriodPattern = /\d+\s*[–\-]\s*\d+\s+\w+\s+\d{4}/,
  ) {
    this.ownerLogin = ownerLogin;
    this.vacationPeriodPattern = vacationPeriodPattern;
  }

  private static buildPattern(startStr: string, endStr: string): RegExp {
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const start = new Date(startStr + "T00:00:00Z");
    const end = new Date(endStr + "T00:00:00Z");
    const sDay = start.getUTCDate();
    const eDay = end.getUTCDate();
    const eMonth = end.getUTCMonth();
    const eYear = end.getUTCFullYear();
    const sDD = String(sDay).padStart(2, "0");
    const sMM = String(start.getUTCMonth() + 1).padStart(2, "0");
    const eDD = String(eDay).padStart(2, "0");
    const eMM = String(eMonth + 1).padStart(2, "0");
    const alternatives = [
      `0?${sDay}\\s*[–\\-]\\s*0?${eDay}\\s+${MONTHS[eMonth]}\\w*\\s+${eYear}`,
      `${sDD}\\.${sMM}.*${eDD}\\.${eMM}`,
      `0?${sDay}\\s+${MONTHS[start.getUTCMonth()]}.*0?${eDay}\\s+${MONTHS[eMonth]}`,
    ];
    return new RegExp(alternatives.join("|"));
  }
}
