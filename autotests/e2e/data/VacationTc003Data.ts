declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-003: Create ADMINISTRATIVE vacation (unpaid)
 *
 * Preconditions:
 * - Active employee, any office
 * - ADMINISTRATIVE skips duration and available days checks
 * - Min duration = 1 day
 */
export class VacationTc003Data {
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
  ): Promise<VacationTc003Data> {
    if (mode === "static") return new VacationTc003Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
      }>("VacationTc003Data");
      if (cached)
        return new VacationTc003Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      // @CurrentUser requires login == token's authenticated user (pvaynmaster on qa-1).
      const login = process.env.VACATION_TC003_LOGIN ?? "pvaynmaster";
      const emp = { login };

      // Find a single conflict-free weekday 2+ weeks out
      const { startDate, paymentMonth } =
        await VacationTc003Data.findAvailableDay(db, emp.login);

      const instance = new VacationTc003Data(
        emp.login,
        startDate,
        startDate, // 1-day vacation: startDate == endDate
        paymentMonth,
      );
      if (mode === "saved")
        saveToDisk("VacationTc003Data", {
          login: emp.login,
          startDate,
          endDate: startDate,
          paymentMonth,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Finds a single conflict-free weekday starting 2 weeks out. */
  private static async findAvailableDay(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; paymentMonth: string }> {
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setDate(now.getDate() + 14);

    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
      const candidate = new Date(baseDate);
      candidate.setDate(baseDate.getDate() + dayOffset);

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
      `Could not find a conflict-free weekday for "${login}" within 60 days`,
    );
  }

  constructor(
    login = process.env.VACATION_TC003_LOGIN ?? "slebedev",
    startDate = process.env.VACATION_TC003_START_DATE ?? "2026-04-13",
    endDate = process.env.VACATION_TC003_END_DATE ?? "2026-04-13",
    paymentMonth = process.env.VACATION_TC003_PAYMENT_MONTH ?? "2026-04-01",
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
