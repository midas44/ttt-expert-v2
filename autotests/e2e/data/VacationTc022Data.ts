declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-022: Create vacation with notifyAlso list
 *
 * Preconditions:
 * - Active employee, valid colleague logins for notify list
 * Expected: Vacation created, vacation_notify_also records created in DB
 *
 * notifyAlso field: validated by @EmployeeLoginCollectionExists at DTO level.
 * DB table: ttt_vacation.vacation_notify_also (vacation FK, approver FK to employee.id, required bool)
 * GET response does NOT include notifyAlso — verification must be via DB.
 *
 * Vault: vacation-service-deep-dive.md § notifyAlso field behavior
 */
export class VacationTc022Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly notifyAlsoLogins: string[];
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc022Data> {
    if (mode === "static") return new VacationTc022Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
        notifyAlsoLogins: string[];
      }>("VacationTc022Data");
      if (cached)
        return new VacationTc022Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
          cached.notifyAlsoLogins,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC022_LOGIN ?? "pvaynmaster";

      // Find 2 random enabled colleague logins (not the owner)
      const colleagues = await db.query<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         WHERE e.enabled = true
           AND e.login != $1
         ORDER BY random()
         LIMIT 2`,
        [login],
      );

      if (colleagues.length < 2) {
        throw new Error("Need at least 2 enabled colleagues for notifyAlso test");
      }
      const notifyAlsoLogins = colleagues.map((c) => c.login);

      const now = new Date();
      const baseDate = new Date(now);
      baseDate.setDate(now.getDate() + 14);
      const dow = baseDate.getDay();
      const daysToMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
      baseDate.setDate(baseDate.getDate() + daysToMon);

      for (let week = 0; week < 40; week++) {
        const start = new Date(baseDate);
        start.setDate(baseDate.getDate() + week * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 4);

        const startIso = toIso(start);
        const endIso = toIso(end);

        const conflict = await hasVacationConflict(db, login, startIso, endIso);
        if (!conflict) {
          const paymentMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
          const instance = new VacationTc022Data(login, startIso, endIso, paymentMonth, notifyAlsoLogins);
          if (mode === "saved")
            saveToDisk("VacationTc022Data", {
              login,
              startDate: startIso,
              endDate: endIso,
              paymentMonth,
              notifyAlsoLogins,
            });
          return instance;
        }
      }
      throw new Error(`Could not find conflict-free Mon-Fri window for "${login}"`);
    } finally {
      await db.close();
    }
  }

  constructor(
    login = "pvaynmaster",
    startDate = "2027-08-02",
    endDate = "2027-08-06",
    paymentMonth = "2027-08-01",
    notifyAlsoLogins = ["ilnitsky", "gerasimov"],
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
    this.paymentMonth = paymentMonth;
    this.notifyAlsoLogins = notifyAlsoLogins;
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
