declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-008: Create ADMINISTRATIVE vacation = 1 day.
 *
 * API test: POST ADMINISTRATIVE vacation with startDate = endDate (1 calendar day).
 * ADMINISTRATIVE type skips duration validation entirely and doesn't check available days.
 * Minimum is 1 working day.
 */
export class VacationTc008Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "ADMINISTRATIVE";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc008Data> {
    if (mode === "static") return new VacationTc008Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const date = await VacationTc008Data.findAvailableDay(db, login, 75);
      return new VacationTc008Data(login, date, date);
    } finally {
      await db.close();
    }
  }

  /** Find a single conflict-free working day (Mon-Fri) */
  private static async findAvailableDay(
    db: DbClient,
    login: string,
    startWeekOffset = 0,
  ): Promise<string> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    for (let attempt = 0; attempt < 20; attempt++) {
      const target = new Date(monday);
      target.setDate(monday.getDate() + attempt);

      // Skip weekends
      const dow = target.getDay();
      if (dow === 0 || dow === 6) continue;

      const iso = toIso(target);
      const conflict = await hasVacationConflict(db, login, iso, iso);
      if (!conflict) {
        return iso;
      }
    }
    throw new Error(
      `No conflict-free working day for "${login}" within 20 days`,
    );
  }

  constructor(
    login = process.env.VACATION_TC008_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC008_START ?? "2028-10-02",
    endDate = process.env.VACATION_TC008_END ?? "2028-10-02",
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

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
