declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-046: APPROVED → CANCELED blocked by canBeCancelled guard.
 *
 * Negative API test: REGULAR+APPROVED vacation with paymentMonth before the
 * office report period. canBeCancelled returns false when
 * reportPeriod.isAfter(paymentDate), protecting accounting integrity.
 *
 * Uses near-future dates with paymentMonth set BEFORE office report period.
 * If the API rejects creation due to paymentMonth validation, the test
 * documents this limitation.
 *
 * NOTE: API_SECRET_TOKEN may bypass the permission check (system user).
 * If cancel succeeds despite the guard conditions, the test documents that
 * the guard is permission-based and not enforceable via system token.
 */
export class VacationTc046Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType = "REGULAR";
  readonly paymentMonth: string;
  readonly reportPeriodStart: string;
  readonly authHeaderName = "API_SECRET_TOKEN";
  readonly vacationEndpoint = "/api/vacation/v1/vacations";

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc046Data> {
    if (mode === "static") return new VacationTc046Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      // Get report period for office 20 (Персей — pvaynmaster's office)
      const reportRow = await db.queryOne<{ start_date: string }>(
        `SELECT op.start_date::text AS start_date
         FROM ttt_backend.office_period op
         WHERE op.office = 20 AND op.type = 'REPORT'`,
      );
      const reportPeriodStart = reportRow.start_date; // e.g. "2026-03-01"

      // paymentMonth must be BEFORE report period for guard to trigger
      const reportDate = new Date(reportPeriodStart + "T00:00:00");
      reportDate.setMonth(reportDate.getMonth() - 1);
      const paymentMonth = toIso(reportDate); // e.g. "2026-02-01"

      // Find conflict-free dates starting from ~3 weeks ahead
      const { startDate, endDate } =
        await VacationTc046Data.findAvailableWeek(db, login, 3);

      return new VacationTc046Data(
        login,
        startDate,
        endDate,
        paymentMonth,
        reportPeriodStart,
      );
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
    login = process.env.VACATION_TC046_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC046_START ?? "2026-04-13",
    endDate = process.env.VACATION_TC046_END ?? "2026-04-17",
    paymentMonth = process.env.VACATION_TC046_PAYMENT ?? "2026-02-01",
    reportPeriodStart = "2026-03-01",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentMonth = paymentMonth;
    this.reportPeriodStart = reportPeriodStart;
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
