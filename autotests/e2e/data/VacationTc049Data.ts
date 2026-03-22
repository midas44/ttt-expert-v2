declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-049: Pay administrative vacation.
 * Finds an accountant and an APPROVED administrative vacation.
 */
export class VacationTc049Data {
  readonly accountantLogin: string;
  readonly vacationId: number;
  readonly administrativeDays: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly periodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc049Data> {
    if (mode === "static") return new VacationTc049Data();

    const db = new DbClient(tttConfig);
    try {
      const accountant = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name IN ('ROLE_ACCOUNTANT', 'ROLE_CHIEF_ACCOUNTANT')
         ORDER BY random()
         LIMIT 1`,
      );

      // Administrative vacations store day count in regular_days column (DB quirk)
      const vacation = await db.queryOne<{
        vacation_id: string;
        regular_days: string;
        start_date: string;
        end_date: string;
      }>(
        `SELECT v.id::text AS vacation_id,
                v.regular_days::text AS regular_days,
                v.start_date::text AS start_date,
                v.end_date::text AS end_date
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         WHERE v.status = 'APPROVED'
           AND v.period_type = 'EXACT'
           AND v.payment_type = 'ADMINISTRATIVE'
           AND e.enabled = true
           AND v.payment_date >= date_trunc('month', CURRENT_DATE)
         ORDER BY v.payment_date ASC, random()
         LIMIT 1`,
      );

      return new VacationTc049Data(
        accountant.login,
        Number(vacation.vacation_id),
        Number(vacation.regular_days),
        vacation.start_date,
        vacation.end_date,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    accountantLogin = process.env.VACATION_TC049_ACCOUNTANT ?? "perekrest",
    vacationId = 0,
    administrativeDays = 1,
    startDate = "2026-04-06",
    endDate = "2026-04-06",
  ) {
    this.accountantLogin = accountantLogin;
    this.vacationId = vacationId;
    this.administrativeDays = administrativeDays;
    this.startDate = startDate;
    this.endDate = endDate;
    this.periodPattern = VacationTc049Data.buildPattern(startDate, endDate);
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
