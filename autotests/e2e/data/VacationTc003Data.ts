declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-003: Create ADMINISTRATIVE vacation (unpaid).
 *
 * API test: POST /api/vacation/v1/vacations with paymentType=ADMINISTRATIVE.
 * Expects: 200, status=NEW, no available days check, min duration = 1 day.
 */
export class VacationTc003Data {
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
  ): Promise<VacationTc003Data> {
    if (mode === "static") return new VacationTc003Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      // Use high offset to land in 2027 (2026 dates polluted with DELETED ghosts)
      const { startDate } =
        await VacationTc003Data.findAvailableDay(db, login, 48);
      return new VacationTc003Data(login, startDate, startDate);
    } finally {
      await db.close();
    }
  }

  /** Finds a single weekday without conflicts. */
  private static async findAvailableDay(
    db: DbClient,
    login: string,
    startWeekOffset = 0,
  ): Promise<{ startDate: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = new Date(monday);
      candidate.setDate(monday.getDate() + attempt);
      // Skip weekends
      const dow = candidate.getDay();
      if (dow === 0 || dow === 6) continue;

      const iso = toIso(candidate);
      const conflict = await hasVacationConflict(db, login, iso, iso);
      if (!conflict) {
        return { startDate: iso };
      }
    }
    throw new Error(
      `No conflict-free weekday for "${login}" within 30 days`,
    );
  }

  constructor(
    login = process.env.VACATION_TC003_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC003_START ?? "2027-02-01",
    endDate = process.env.VACATION_TC003_END ?? "2027-02-01",
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
