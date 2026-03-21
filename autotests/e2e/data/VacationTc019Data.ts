declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-019: Regular employee auto-approver assignment.
 *
 * When a regular employee (NOT CPO/DM) with a manager creates a vacation:
 *   vacation.approverId = employee.getManager().getId()  — manager as primary approver
 *   No optional approvers auto-added (unlike CPO path).
 *
 * Uses API_SECRET_TOKEN with a non-DM employee login to test the standard approver path.
 */
export class VacationTc019Data {
  readonly login: string;
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
  ): Promise<VacationTc019Data> {
    if (mode === "static") return new VacationTc019Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const db = new DbClient(tttConfig);
    try {
      // Find a non-DM employee with a manager in the vacation schema
      const candidates = await db.query<{
        login: string;
        manager_login: string;
      }>(
        `SELECT ve.login, vm.login AS manager_login
         FROM ttt_vacation.employee ve
         JOIN ttt_vacation.employee vm ON ve.manager = vm.id
         WHERE ve.manager IS NOT NULL
           AND ve.login != 'pvaynmaster'
           AND NOT EXISTS (
             SELECT 1 FROM ttt_backend.employee_global_roles r
             JOIN ttt_backend.employee be ON r.employee = be.id
             WHERE be.login = ve.login
               AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
           )
           AND EXISTS (
             SELECT 1 FROM ttt_backend.employee be
             WHERE be.login = ve.login AND be.enabled = true
           )
         LIMIT 10`,
      );

      if (candidates.length === 0) {
        throw new Error("No suitable non-DM employee with manager found in DB");
      }

      // Try each candidate until we find one with a conflict-free week
      for (const candidate of candidates) {
        try {
          const { startDate, endDate } =
            await VacationTc019Data.findAvailableWeek(db, candidate.login, 254);
          return new VacationTc019Data(
            candidate.login,
            candidate.manager_login,
            startDate,
            endDate,
          );
        } catch {
          // This candidate has no free week, try next
          continue;
        }
      }

      throw new Error("No candidate employee has a conflict-free week available");
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
      `No conflict-free week for "${login}" from offset ${startWeekOffset}`,
    );
  }

  constructor(
    login = process.env.VACATION_TC019_LOGIN ?? "test_regular_employee",
    managerLogin = process.env.VACATION_TC019_MANAGER ?? "test_manager",
    startDate = process.env.VACATION_TC019_START ?? "2031-02-10",
    endDate = process.env.VACATION_TC019_END ?? "2031-02-14",
  ) {
    this.login = login;
    this.managerLogin = managerLogin;
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
}

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
