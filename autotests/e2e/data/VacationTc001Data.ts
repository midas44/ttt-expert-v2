declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-001: Create REGULAR vacation — happy path (AV=false office)
 *
 * Preconditions:
 * - Employee in AV=false office
 * - Sufficient accrued days (>=5)
 * - No overlapping vacations
 * - Has manager (for approver auto-assignment)
 */
export class VacationTc001Data {
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
  ): Promise<VacationTc001Data> {
    if (mode === "static") return new VacationTc001Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
      }>("VacationTc001Data");
      if (cached)
        return new VacationTc001Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      // @CurrentUser requires login == token's authenticated user (pvaynmaster on qa-1).
      // pvaynmaster is in AV=true office — TC-VAC-001 requires AV=false.
      // This test is BLOCKED for API mode unless the token user is in an AV=false office.
      const login = process.env.VACATION_TC001_LOGIN ?? "pvaynmaster";

      const officeCheck = await db.queryOne<{ advance_vacation: boolean }>(
        `SELECT vo.advance_vacation
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.office vo ON vo.id = ve.office_id
         WHERE ve.login = $1`,
        [login],
      );

      if (officeCheck.advance_vacation) {
        throw new Error(
          `User "${login}" is in AV=true office — TC-VAC-001 requires AV=false. ` +
          `Blocked: @CurrentUser prevents API tests for employees in different offices.`,
        );
      }

      const emp = { login };

      // Find conflict-free Mon-Fri window within 8 weeks
      const { startDate, endDate, paymentMonth } =
        await VacationTc001Data.findAvailableDates(db, emp.login);

      const instance = new VacationTc001Data(
        emp.login,
        startDate,
        endDate,
        paymentMonth,
      );
      if (mode === "saved")
        saveToDisk("VacationTc001Data", {
          login: emp.login,
          startDate,
          endDate,
          paymentMonth,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  /** Finds a Mon-Fri (5 working days) window without conflicts, starting 2+ weeks out. */
  private static async findAvailableDates(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; endDate: string; paymentMonth: string }> {
    const now = new Date();
    // Start searching from 2 weeks ahead to avoid edge cases
    const baseDate = new Date(now);
    baseDate.setDate(now.getDate() + 14);

    // Advance to next Monday
    const dayOfWeek = baseDate.getDay();
    const daysUntilMon = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    baseDate.setDate(baseDate.getDate() + daysUntilMon);

    for (let week = 0; week < 26; week++) {
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate() + week * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4); // Friday (Mon + 4 = 5 calendar days)

      const startIso = toIso(start);
      const endIso = toIso(end);

      const conflict = await hasVacationConflict(db, login, startIso, endIso);
      if (!conflict) {
        const paymentMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
        return { startDate: startIso, endDate: endIso, paymentMonth };
      }
    }
    throw new Error(
      `Could not find a conflict-free Mon-Fri window for "${login}" within 26 weeks`,
    );
  }

  constructor(
    login = process.env.VACATION_TC001_LOGIN ?? "slebedev",
    startDate = process.env.VACATION_TC001_START_DATE ?? "2026-04-13",
    endDate = process.env.VACATION_TC001_END_DATE ?? "2026-04-17",
    paymentMonth = process.env.VACATION_TC001_PAYMENT_MONTH ?? "2026-04-01",
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
