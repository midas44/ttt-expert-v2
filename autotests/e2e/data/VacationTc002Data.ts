declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-002: Create REGULAR vacation — happy path (AV=true office)
 *
 * Preconditions:
 * - Employee in AV=true office (e.g. Cyprus / Персей)
 * - Sufficient balance (full year available from Jan 1)
 * - No overlapping vacations
 * - Has manager for approver assignment
 */
export class VacationTc002Data {
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
  ): Promise<VacationTc002Data> {
    if (mode === "static") return new VacationTc002Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
      }>("VacationTc002Data");
      if (cached)
        return new VacationTc002Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      // @CurrentUser requires login == token's authenticated user (pvaynmaster on qa-1).
      // pvaynmaster is in Персей office (AV=true). Verify at runtime.
      const login = process.env.VACATION_TC002_LOGIN ?? "pvaynmaster";

      const officeCheck = await db.queryOne<{ advance_vacation: boolean }>(
        `SELECT vo.advance_vacation
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.office vo ON vo.id = ve.office_id
         WHERE ve.login = $1`,
        [login],
      );

      if (!officeCheck.advance_vacation) {
        throw new Error(
          `User "${login}" is in AV=false office — TC-VAC-002 requires AV=true`,
        );
      }

      const emp = { login };

      // Find conflict-free Mon-Fri window
      const { startDate, endDate, paymentMonth } =
        await VacationTc002Data.findAvailableDates(db, emp.login);

      const instance = new VacationTc002Data(
        emp.login,
        startDate,
        endDate,
        paymentMonth,
      );
      if (mode === "saved")
        saveToDisk("VacationTc002Data", {
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

  private static async findAvailableDates(
    db: DbClient,
    login: string,
  ): Promise<{ startDate: string; endDate: string; paymentMonth: string }> {
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setDate(now.getDate() + 14);

    const dayOfWeek = baseDate.getDay();
    const daysUntilMon = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    baseDate.setDate(baseDate.getDate() + daysUntilMon);

    for (let week = 0; week < 26; week++) {
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate() + week * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);

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
    login = process.env.VACATION_TC002_LOGIN ?? "pvaynmaster",
    startDate = process.env.VACATION_TC002_START_DATE ?? "2026-04-20",
    endDate = process.env.VACATION_TC002_END_DATE ?? "2026-04-24",
    paymentMonth = process.env.VACATION_TC002_PAYMENT_MONTH ?? "2026-04-01",
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
