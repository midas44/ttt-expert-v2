declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-007: Create REGULAR vacation = 5 calendar days (Mon-Fri boundary)
 *
 * Preconditions:
 * - Active employee in AV=true office with sufficient balance
 * - No overlapping vacations in the chosen Mon-Fri window
 * Expected: HTTP 200, vacation created with regularDays=5
 *
 * NOTE: minimalVacationDuration=1, so 5 days is well above the minimum.
 * This test verifies the standard 5-day Mon-Fri vacation creation path.
 */
export class VacationTc007Data {
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
  ): Promise<VacationTc007Data> {
    if (mode === "static") return new VacationTc007Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
      }>("VacationTc007Data");
      if (cached)
        return new VacationTc007Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC007_LOGIN ?? "pvaynmaster";

      const { startDate, endDate, paymentMonth } =
        await VacationTc007Data.findAvailableDates(db, login);

      const instance = new VacationTc007Data(login, startDate, endDate, paymentMonth);
      if (mode === "saved")
        saveToDisk("VacationTc007Data", { login, startDate, endDate, paymentMonth });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Find a conflict-free Mon-Fri window starting 4+ weeks ahead. */
  private static async findAvailableDates(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; endDate: string; paymentMonth: string }> {
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setDate(now.getDate() + 28);

    const dayOfWeek = baseDate.getDay();
    const daysUntilMon = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    baseDate.setDate(baseDate.getDate() + daysUntilMon);

    for (let week = 0; week < 40; week++) {
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate() + week * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4); // Mon-Fri = 5 calendar days

      const startIso = toIso(start);
      const endIso = toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        const paymentMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
        return { startDate: startIso, endDate: endIso, paymentMonth };
      }
    }
    throw new Error(
      `Could not find a conflict-free Mon-Fri window for "${login}" within 40 weeks`,
    );
  }

  constructor(
    login = process.env.VACATION_TC007_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC007_START_DATE ?? "2026-05-04",
    endDate = process.env.VACATION_TC007_END_DATE ?? "2026-05-08",
    paymentMonth = process.env.VACATION_TC007_PAYMENT_MONTH ?? "2026-05-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
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
