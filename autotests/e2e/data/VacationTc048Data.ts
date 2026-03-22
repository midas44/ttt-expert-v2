declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

const MONTH_ABBREVS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface ApprovedVacationRow {
  employee_login: string;
  employee_name: string;
  vacation_id: string;
  regular_days: string;
  administrative_days: string;
  start_date: string;
  end_date: string;
  payment_month: string;
}

/**
 * TC-VAC-048: Pay APPROVED vacation (accountant view).
 * Finds an accountant login and an APPROVED Regular vacation in the current payment month.
 */
export class VacationTc048Data {
  readonly accountantLogin: string;
  readonly employeeName: string;
  readonly vacationId: number;
  readonly regularDays: number;
  readonly administrativeDays: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentMonth: string;
  readonly periodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc048Data> {
    if (mode === "static") return new VacationTc048Data();

    const db = new DbClient(tttConfig);
    try {
      // Find an accountant
      const accountant = await db.queryOne<{ login: string }>(
        `SELECT be.login
         FROM ttt_backend.employee be
         JOIN ttt_backend.employee_global_roles r ON r.employee = be.id
         WHERE be.enabled = true
           AND r.role_name IN ('ROLE_ACCOUNTANT', 'ROLE_CHIEF_ACCOUNTANT')
         ORDER BY random()
         LIMIT 1`,
      );

      // Find an APPROVED Regular vacation with payment month in current or future month
      const vacation = await db.queryOne<ApprovedVacationRow>(
        `SELECT e.login AS employee_login,
                COALESCE(be.latin_last_name || ' ' || be.latin_first_name, e.login) AS employee_name,
                v.id::text AS vacation_id,
                v.regular_days::text AS regular_days,
                v.administrative_days::text AS administrative_days,
                v.start_date::text AS start_date,
                v.end_date::text AS end_date,
                v.payment_date::text AS payment_month
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         LEFT JOIN ttt_backend.employee be ON be.login = e.login
         WHERE v.status = 'APPROVED'
           AND v.period_type = 'EXACT'
           AND v.payment_type = 'REGULAR'
           AND e.enabled = true
           AND v.regular_days > 0
           AND v.payment_date >= date_trunc('month', CURRENT_DATE)
         ORDER BY v.payment_date ASC, random()
         LIMIT 1`,
      );

      return new VacationTc048Data(
        accountant.login,
        vacation.employee_name,
        Number(vacation.vacation_id),
        Number(vacation.regular_days),
        Number(vacation.administrative_days),
        vacation.start_date,
        vacation.end_date,
        vacation.payment_month,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    accountantLogin = process.env.VACATION_TC048_ACCOUNTANT ?? "perekrest",
    employeeName = "Nadim Abderrahim",
    vacationId = 0,
    regularDays = 1,
    administrativeDays = 0,
    startDate = "2026-03-23",
    endDate = "2026-03-23",
    paymentMonth = "2026-03-01",
  ) {
    this.accountantLogin = accountantLogin;
    this.employeeName = employeeName;
    this.vacationId = vacationId;
    this.regularDays = regularDays;
    this.administrativeDays = administrativeDays;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = paymentMonth;
    this.periodPattern = this.buildPattern(startDate, endDate);
  }

  /** Returns the payment month formatted for the quick-tab buttons (e.g., "Mar 2026"). */
  get paymentMonthTab(): string {
    const d = new Date(this.paymentMonth + "T00:00:00Z");
    return `${MONTH_ABBREVS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  private buildPattern(startStr: string, endStr: string): RegExp {
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
      `0?${sDay}\\s*[–\\-]\\s*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}\\w*\\s+${eYear}`,
      `${sDD}\\.${sMM}.*${eDD}\\.${eMM}`,
      `0?${sDay}\\s+${MONTH_ABBREVS[start.getUTCMonth()]}.*0?${eDay}\\s+${MONTH_ABBREVS[eMonth]}`,
    ];
    return new RegExp(alternatives.join("|"));
  }
}
