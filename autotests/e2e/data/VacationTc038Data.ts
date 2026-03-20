declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-038: Update payment month to closed accounting period.
 *
 * API test: Create vacation → PUT update with paymentMonth set to a closed (past) period.
 * Expected: 400 with errorCode validation.vacation.dates.payment.
 * The isPaymentDateCorrect validator rejects paymentMonth outside the valid range.
 */
export class VacationTc038Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly closedPaymentMonth: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc038Data> {
    if (mode === "static") return new VacationTc038Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      const { startDate, endDate } =
        await VacationTc038Data.findAvailableWeek(db, login, 215);

      // Find the current report period to determine what counts as "closed"
      const periodRows = await db.query(
        `SELECT op.start_date FROM ttt_backend.office_period op
         JOIN ttt_vacation.employee e ON op.office = e.office_id
         WHERE e.login = $1 AND op.type = 'REPORT'`,
        [login],
      );
      let closedMonth = "2025-01-01"; // safe fallback — well in the past
      if (periodRows.length > 0) {
        // Report period start - 2 months is definitely closed
        const rpStart = new Date(periodRows[0].start_date as string);
        rpStart.setMonth(rpStart.getMonth() - 2);
        closedMonth = `${rpStart.getFullYear()}-${String(rpStart.getMonth() + 1).padStart(2, "0")}-01`;
      }

      return new VacationTc038Data(login, startDate, endDate, closedMonth);
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
    login = process.env.VACATION_TC038_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC038_START ?? "2030-05-13",
    endDate = process.env.VACATION_TC038_END ?? "2030-05-17",
    closedPaymentMonth = "2025-01-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = startDate.slice(0, 7) + "-01";
    this.closedPaymentMonth = closedPaymentMonth;
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

  /** Update body with paymentMonth set to a closed accounting period */
  buildUpdateWithClosedPayment(vacationId: number): Record<string, unknown> {
    return {
      id: vacationId,
      login: this.login,
      startDate: this.startDate,
      endDate: this.endDate,
      paymentType: this.paymentType,
      paymentMonth: this.closedPaymentMonth,
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
