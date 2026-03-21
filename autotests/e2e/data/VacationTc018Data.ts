declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";

/**
 * Test data for TC-VAC-018: CPO auto-approver self-assignment.
 *
 * When a CPO/DM (isCPO=true) with a manager creates a vacation:
 *   vacation.approverId = employee.getId()  — self-approve
 *   employee.getManager().getLogin() added to optionalApprovers  — manager as optional
 *
 * pvaynmaster is DEPARTMENT_MANAGER (isCPO=true), manager=ilnitsky.
 */
export class VacationTc018Data {
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
  ): Promise<VacationTc018Data> {
    if (mode === "static") return new VacationTc018Data();
    if (mode === "saved")
      throw new Error('testDataMode "saved" is not yet implemented');

    const login = "pvaynmaster";
    const db = new DbClient(tttConfig);
    try {
      // Look up manager login from DB
      const managerRow = await db.query<{ login: string }>(
        `SELECT m.login FROM ttt_vacation.employee e
         JOIN ttt_vacation.employee m ON e.manager = m.id
         WHERE e.login = $1`,
        [login],
      );
      const managerLogin = managerRow.length > 0 ? managerRow[0].login : "ilnitsky";

      const { startDate, endDate } =
        await VacationTc018Data.findAvailableWeek(db, login, 248);
      return new VacationTc018Data(login, managerLogin, startDate, endDate);
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
    login = process.env.VACATION_TC018_LOGIN ?? "pvaynmaster",
    managerLogin = process.env.VACATION_TC018_MANAGER ?? "ilnitsky",
    startDate = process.env.VACATION_TC018_START ?? "2031-01-13",
    endDate = process.env.VACATION_TC018_END ?? "2031-01-17",
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
