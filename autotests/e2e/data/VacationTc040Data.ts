declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-040: NEW → REJECTED (approver rejects).
 *
 * API test: Create vacation as employee, then reject as manager.
 * Expects: status changes from NEW to REJECTED, days returned.
 */
export class VacationTc040Data {
  readonly employeeLogin: string;
  readonly managerLogin: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc040Data> {
    if (mode === "static") return new VacationTc040Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    // API_SECRET_TOKEN authenticates as pvaynmaster — login must match.
    // pvaynmaster is their own approver, so approve/reject works with same token.
    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } = await VacationTc040Data.findAvailableWeek(
        db,
        login,
        6,
      );
      return new VacationTc040Data(login, login, startDate, endDate);
    } finally {
      await db.close();
    }
  }

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
      end.setDate(start.getDate() + 4);

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
    employeeLogin = process.env.VACATION_TC040_EMPLOYEE ?? "pvaynmaster",
    managerLogin = process.env.VACATION_TC040_MANAGER ?? "pvaynmaster",
    startDate = process.env.VACATION_TC040_START ?? "2026-04-20",
    endDate = process.env.VACATION_TC040_END ?? "2026-04-24",
  ) {
    this.employeeLogin = employeeLogin;
    this.managerLogin = managerLogin;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
  }

  buildCreateBody(): Record<string, unknown> {
    return {
      login: this.employeeLogin,
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
