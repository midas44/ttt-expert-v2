declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-169: Update vacation start date to past — validation rejects.
 *
 * VacationUpdateValidator delegates to VacationCreateValidator.isStartEndDatesCorrect():
 *   if (startDate.isBefore(today)) → validation.vacation.start.date.in.past
 * Same past-date check applies to both create and update paths.
 */
export class VacationTc169Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly pastStartDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  readonly expectedErrorCode = "exception.validation";
  readonly expectedViolationCode = "validation.vacation.start.date.in.past";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc169Data> {
    if (mode === "static") return new VacationTc169Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc169Data.findAvailableWeek(db, login, 251);

      const now = new Date();
      const pastStart = new Date(now);
      pastStart.setDate(now.getDate() - 5);

      return new VacationTc169Data(login, startDate, endDate, toIso(pastStart));
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
    login = process.env.VACATION_TC169_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC169_START ?? "2031-02-03",
    endDate = process.env.VACATION_TC169_END ?? "2031-02-07",
    pastStartDate = process.env.VACATION_TC169_PAST_START ?? "2026-03-16",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.pastStartDate = pastStartDate;
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

  buildUpdateBody(vacationId: number): Record<string, unknown> {
    return {
      id: vacationId,
      login: this.login,
      startDate: this.pastStartDate,
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
