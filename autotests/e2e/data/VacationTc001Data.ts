declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-001: Create REGULAR vacation — happy path (AV=false office).
 *
 * API test: POST /api/vacation/v1/vacations with valid REGULAR vacation data.
 * Expects: 200, status=NEW, approver auto-assigned, days=5.
 */
export class VacationTc001Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc001Data> {
    if (mode === "static") return new VacationTc001Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // API_SECRET_TOKEN authenticates as pvaynmaster — login must match
    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc001Data.findAvailableWeek(db, login, 9);
      return new VacationTc001Data(login, startDate, endDate);
    } finally {
      await db.close();
    }
  }

  /** Finds a Mon-Fri window without conflicts, starting from next Monday. */
  private static async findAvailableWeek(
    db: DbClient,
    login: string,
    startWeekOffset = 0,
  ): Promise<{ startDate: string; endDate: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    for (let attempt = 0; attempt < 12; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4); // Friday

      const startIso = toIso(start);
      const endIso = toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return { startDate: startIso, endDate: endIso };
      }
    }
    throw new Error(
      `No conflict-free Mon-Fri window for "${login}" within 12 weeks`,
    );
  }

  constructor(
    login = process.env.VACATION_TC001_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC001_START ?? "2026-04-06",
    endDate = process.env.VACATION_TC001_END ?? "2026-04-10",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    // Payment month = 1st of the start date's month
    this.paymentMonth = startDate.slice(0, 7) + "-01";
  }

  /** Builds the request body for POST /vacations */
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
