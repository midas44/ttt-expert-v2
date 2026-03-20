declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-126: Sick leave crossing vacation — 409 CONFLICT.
 *
 * API test: Create a vacation, then POST a sick leave with overlapping dates (force=false).
 * SickLeaveCrossingVacationException is unique — only vacation-module exception returning 409.
 *
 * Note: The 409 is thrown from POST /api/vacation/v1/sick-leaves (not /vacations).
 * The vacation service only throws 400 for crossing vacations.
 */
export class VacationTc126Data {
  readonly login: string;
  readonly vacationStartDate: string;
  readonly vacationEndDate: string;
  readonly sickLeaveStartDate: string;
  readonly sickLeaveEndDate: string;
  readonly paymentType = "ADMINISTRATIVE";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";
  readonly sickLeaveEndpoint = "/api/vacation/v1/sick-leaves";
  readonly expectedErrorCode = "exception.sick.leave.crossing.vacation";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc126Data> {
    if (mode === "static") return new VacationTc126Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc126Data.findAvailableWeek(db, login, 221);
      return new VacationTc126Data(login, startDate, endDate);
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
      end.setDate(start.getDate() + 4); // Friday

      const startIso = toIso(start);
      const endIso = toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        return { startDate: startIso, endDate: endIso };
      }
    }
    throw new Error(
      `No conflict-free week for "${login}" within 12 attempts from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC126_LOGIN ?? "pvaynmaster",
    vacationStartDate = process.env.VACATION_TC126_VAC_START ?? "2030-05-06",
    vacationEndDate = process.env.VACATION_TC126_VAC_END ?? "2030-05-10",
  ) {
    this.login = login;
    this.vacationStartDate = vacationStartDate;
    this.vacationEndDate = vacationEndDate;
    // Sick leave overlaps the middle of the vacation (Wed-Thu)
    const start = new Date(vacationStartDate);
    const slStart = new Date(start);
    slStart.setDate(start.getDate() + 2); // Wednesday
    const slEnd = new Date(start);
    slEnd.setDate(start.getDate() + 3); // Thursday
    this.sickLeaveStartDate = toIso(slStart);
    this.sickLeaveEndDate = toIso(slEnd);
    this.paymentMonth = vacationStartDate.slice(0, 7) + "-01";
  }

  buildVacationBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.vacationStartDate,
      endDate: this.vacationEndDate,
      paymentType: this.paymentType,
      paymentMonth: this.paymentMonth,
      optionalApprovers: [],
      notifyAlso: [],
    };
  }

  buildSickLeaveBody(): Record<string, unknown> {
    return {
      login: this.login,
      startDate: this.sickLeaveStartDate,
      endDate: this.sickLeaveEndDate,
      force: false,
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
