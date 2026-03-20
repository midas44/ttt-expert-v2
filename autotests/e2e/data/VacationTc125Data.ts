declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-125: ServiceException vs ValidationException — format difference.
 *
 * API test: trigger both exception types and compare response structures.
 * ServiceException: thrown from service layer (e.g., approve already-APPROVED vacation).
 *   Has specific top-level errorCode, NO errors[] array.
 * ValidationException (MethodArgumentNotValidException): thrown by Spring validation.
 *   Has generic errorCode "exception.validation" + errors[] array with field-level details.
 *
 * Flow: create vacation → approve (self) → double-approve → ServiceException.
 */
export class VacationTc125Data {
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
  ): Promise<VacationTc125Data> {
    if (mode === "static") return new VacationTc125Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc125Data.findAvailableWeek(db, login, 221);
      return new VacationTc125Data(login, startDate, endDate);
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
      `No conflict-free Mon-Fri window for "${login}" within 24 weeks from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC125_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC125_START ?? "2030-06-17",
    endDate = process.env.VACATION_TC125_END ?? "2030-06-21",
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

  /** Triggers MethodArgumentNotValidException via missing @NotNull fields → errors[] array */
  buildValidationExceptionBody(): Record<string, unknown> {
    return {
      // All @NotNull fields omitted: login, startDate, endDate, paymentType
    };
  }
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
