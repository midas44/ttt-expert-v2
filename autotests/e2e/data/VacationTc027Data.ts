declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";

/**
 * TC-VAC-027: Cannot cancel APPROVED vacation after accounting period close.
 * Finds an APPROVED REGULAR vacation with a payment_date in the current month,
 * then the test advances the clock past the payment month to close the period.
 */
export class VacationTc027Data {
  readonly username: string;
  readonly paymentDate: string;
  readonly startDate: string;
  readonly endDate: string;
  /** Date string to set the clock to (first day of month after paymentDate) */
  readonly clockTime: string;
  /** Pattern to find the vacation row (e.g. "Mar 02 – Mar 13") */
  readonly periodPattern: RegExp;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc027Data> {
    if (mode === "static") return new VacationTc027Data();

    const db = new DbClient(tttConfig);
    try {
      // Find an APPROVED REGULAR vacation with payment_date in a recent month
      const vac = await db.queryOne<{
        login: string;
        payment_date: string;
        start_date: string;
        end_date: string;
      }>(
        `SELECT
           e.login,
           v.payment_date::text AS payment_date,
           v.start_date::text AS start_date,
           v.end_date::text AS end_date
         FROM ttt_vacation.vacation v
         JOIN ttt_vacation.employee e ON v.employee = e.id
         WHERE v.status = 'APPROVED'
           AND v.payment_type = 'REGULAR'
           AND e.enabled = true
           AND v.payment_date IS NOT NULL
         ORDER BY v.payment_date ASC
         LIMIT 1`,
      );

      // Calculate clock time: 3 months after the payment date to ensure period is closed
      const pd = new Date(vac.payment_date);
      const clockDate = new Date(pd.getFullYear(), pd.getMonth() + 3, 15);
      const clockTime = `${clockDate.getFullYear()}-${String(clockDate.getMonth() + 1).padStart(2, "0")}-${String(clockDate.getDate()).padStart(2, "0")}T10:00:00`;

      // Build period pattern from start/end dates
      // Table format: "DD - DD Mon YYYY" (same month) or "DD Mon - DD Mon YYYY"
      const sd = new Date(vac.start_date);
      const ed = new Date(vac.end_date);
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const startDay = sd.getDate();
      const endDay = ed.getDate();
      const startMon = months[sd.getMonth()];
      const endMon = months[ed.getMonth()];
      // Match flexibly: "02 - 13 Mar 2026" or "02 Mar - 13 Mar 2026"
      const pattern = new RegExp(
        `${String(startDay).padStart(2, "0")}.*${String(endDay).padStart(2, "0")}.*${endMon}.*${ed.getFullYear()}`,
      );

      return new VacationTc027Data(
        vac.login,
        vac.payment_date,
        vac.start_date,
        vac.end_date,
        clockTime,
        pattern,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    username = process.env.VACATION_TC027_USERNAME ?? "imalakhovskaia",
    paymentDate = "2026-03-01",
    startDate = "2026-03-02",
    endDate = "2026-03-13",
    clockTime = "2026-04-15T10:00:00",
    periodPattern = /Mar 02.*Mar 13/,
  ) {
    this.username = username;
    this.paymentDate = paymentDate;
    this.startDate = startDate;
    this.endDate = endDate;
    this.clockTime = clockTime;
    this.periodPattern = periodPattern;
  }
}
