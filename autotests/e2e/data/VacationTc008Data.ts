declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-008: Create ADMINISTRATIVE vacation = 1 day
 *
 * Preconditions:
 * - Active employee
 * - Single future weekday with no vacation conflicts
 * Expected: HTTP 200, vacation created with administrativeDays=1, regularDays=0
 *
 * ADMINISTRATIVE type has no available-days validation (unpaid leave).
 * Minimum duration check still applies (minimalVacationDuration=1 working day).
 */
export class VacationTc008Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc008Data> {
    if (mode === "static") return new VacationTc008Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        paymentMonth: string;
      }>("VacationTc008Data");
      if (cached)
        return new VacationTc008Data(
          cached.login,
          cached.startDate,
          cached.startDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC008_LOGIN ?? "pvaynmaster";

      const { startDate, paymentMonth } =
        await VacationTc008Data.findAvailableDay(db, login);

      const instance = new VacationTc008Data(login, startDate, startDate, paymentMonth);
      if (mode === "saved")
        saveToDisk("VacationTc008Data", {
          login,
          startDate,
          paymentMonth,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Find a conflict-free single weekday starting 5+ weeks ahead. */
  private static async findAvailableDay(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; paymentMonth: string }> {
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setDate(now.getDate() + 35);

    for (let day = 0; day < 180; day++) {
      const candidate = new Date(baseDate);
      candidate.setDate(baseDate.getDate() + day);

      // Skip weekends
      const dow = candidate.getDay();
      if (dow === 0 || dow === 6) continue;

      const iso = toIso(candidate);
      const conflict = await hasVacationConflict(db, login, iso, iso);
      if (!conflict) {
        const paymentMonth = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-01`;
        return { startDate: iso, paymentMonth };
      }
    }
    throw new Error(
      `Could not find a conflict-free weekday for "${login}" within 180 days`,
    );
  }

  constructor(
    login = process.env.VACATION_TC008_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC008_START_DATE ?? "2026-05-11",
    endDate = process.env.VACATION_TC008_END_DATE ?? "2026-05-11",
    paymentMonth = process.env.VACATION_TC008_PAYMENT_MONTH ?? "2026-05-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "ADMINISTRATIVE";
    this.paymentMonth = paymentMonth;
    this.authHeaderName = "API_SECRET_TOKEN";
    this.vacationEndpoint = "/api/vacation/v1/vacations";
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
