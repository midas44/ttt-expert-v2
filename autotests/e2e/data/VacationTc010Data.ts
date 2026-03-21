declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-010: Create with insufficient available days (AV=true)
 *
 * Preconditions:
 * - Employee in AV=true office
 * - Vacation duration exceeds total available paid days
 * Expected: HTTP 400, error code: validation.vacation.duration
 *
 * AV=true offices get full year balance from Jan 1, but the create
 * validator still checks: availablePaidDays < total → rejects.
 * We query the actual available days and create a vacation exceeding them.
 */
export class VacationTc010Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly availableDays: number;
  readonly expectedErrorCode: string;
  readonly expectedHttpStatus: number;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc010Data> {
    if (mode === "static") return new VacationTc010Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
        availableDays: number;
      }>("VacationTc010Data");
      if (cached)
        return new VacationTc010Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
          cached.availableDays,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC010_LOGIN ?? "pvaynmaster";

      // Verify AV=true office
      const officeCheck = await db.queryOne<{ advance_vacation: boolean }>(
        `SELECT vo.advance_vacation
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.office vo ON vo.id = ve.office_id
         WHERE ve.login = $1`,
        [login],
      );
      if (!officeCheck.advance_vacation) {
        throw new Error(`User "${login}" is in AV=false office — TC-VAC-010 requires AV=true`);
      }

      // Get total available paid days across all years
      const daysResult = await db.queryOne<{ total_days: string }>(
        `SELECT COALESCE(SUM(ev.available_vacation_days), 0)::text AS total_days
         FROM ttt_vacation.employee_vacation ev
         JOIN ttt_vacation.employee e ON e.id = ev.employee
         WHERE e.login = $1`,
        [login],
      );
      const availableDays = Number(daysResult.total_days);

      // Compute vacation longer than available days
      // Target working days = available + 15 (generous buffer), minimum 50
      const targetWorkingDays = Math.max(availableDays + 15, 50);
      // Convert to calendar days: 5 working days per 7 calendar days + buffer
      const calendarDays = Math.ceil(targetWorkingDays * 7 / 5) + 14;

      // Start date: ~6 months ahead to avoid ghost conflicts from prior tests
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() + 180);
      // Align to Monday
      const dow = start.getDay();
      const daysToMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
      start.setDate(start.getDate() + daysToMon);

      const end = new Date(start);
      end.setDate(start.getDate() + calendarDays);

      const startIso = toIso(start);
      const endIso = toIso(end);
      const paymentMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;

      const instance = new VacationTc010Data(login, startIso, endIso, paymentMonth, availableDays);
      if (mode === "saved")
        saveToDisk("VacationTc010Data", {
          login,
          startDate: startIso,
          endDate: endIso,
          paymentMonth,
          availableDays,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  constructor(
    login = process.env.VACATION_TC010_LOGIN ?? "pvaynmaster",
    startDate = "2026-09-21",
    endDate = "2027-02-20",
    paymentMonth = "2026-09-01",
    availableDays = 24,
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
    this.paymentMonth = paymentMonth;
    this.availableDays = availableDays;
    this.expectedErrorCode = "validation.vacation.duration";
    this.expectedHttpStatus = 400;
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
