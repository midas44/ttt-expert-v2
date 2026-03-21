declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-162: AV=true — Vacation days display on main Vacations page
 * uses availablePaidDays (not currentYear).
 *
 * MR !5169 fixed UserVacationsPage.js:102 to display `availablePaidDays`.
 * This hybrid test verifies the UI display matches the API value, and updates
 * correctly after vacation create/delete.
 */
export class VacationTc162Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly availableDaysEndpoint = "/api/vacation/v1/vacationdays/available";
  readonly myVacationsPath = "/vacation/my/my-vacation/OPENED";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc162Data> {
    if (mode === "static") return new VacationTc162Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc162Data.findAvailableWeek(db, login, 275);
      return new VacationTc162Data(login, startDate, endDate);
    } finally {
      await db.close();
    }
  }

  private static async findAvailableWeek(
    db: DbClient,
    login: string,
    startWeekOffset: number,
  ): Promise<{ startDate: string; endDate: string }> {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday + startWeekOffset * 7);

    for (let attempt = 0; attempt < 24; attempt++) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + attempt * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

      const startIso = toIso(start);
      const endIso = toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return { startDate: startIso, endDate: endIso };
      }
    }
    throw new Error(
      `No conflict-free week for "${login}" from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC162_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC162_START ?? "2031-06-16",
    endDate = process.env.VACATION_TC162_END ?? "2031-06-20",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
  }

  /** Query string for the available days endpoint (main page mode: newDays=0). */
  buildAvailableQuery(): string {
    const now = new Date();
    const paymentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return `employeeLogin=${this.login}&newDays=0&paymentDate=${paymentDate}&usePaymentDateFilter=true`;
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
