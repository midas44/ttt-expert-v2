declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-023: Create vacation with invalid notifyAlso login
 *
 * Preconditions:
 * - Active employee, one invalid login in notifyAlso list
 * Expected: HTTP 400 from @EmployeeLoginCollectionExists validator
 *
 * The @EmployeeLoginCollectionExists annotation validates each login in the list.
 * A nonexistent login causes ConstraintViolationException.
 *
 * Vault: vacation-service-deep-dive.md § DTO-Level Validation, § notifyAlso
 */
export class VacationTc023Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly validColleagueLogin: string;
  readonly invalidLogin: string;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc023Data> {
    if (mode === "static") return new VacationTc023Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
        validColleagueLogin: string;
      }>("VacationTc023Data");
      if (cached)
        return new VacationTc023Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
          cached.validColleagueLogin,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC023_LOGIN ?? "pvaynmaster";

      // Find one valid colleague login
      const colleague = await db.queryOne<{ login: string }>(
        `SELECT e.login
         FROM ttt_vacation.employee e
         WHERE e.enabled = true
           AND e.login != $1
         ORDER BY random()
         LIMIT 1`,
        [login],
      );

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
          const instance = new VacationTc023Data(
            login,
            startIso,
            endIso,
            paymentMonth,
            colleague.login,
          );
          if (mode === "saved")
            saveToDisk("VacationTc023Data", {
              login,
              startDate: startIso,
              endDate: endIso,
              paymentMonth,
              validColleagueLogin: colleague.login,
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
    startDate = "2027-08-16",
    endDate = "2027-08-20",
    paymentMonth = "2027-08-01",
    validColleagueLogin = "ilnitsky",
  ) {
    this.login = login;
    this.startDate = startDate;
    this.endDate = endDate;
    this.paymentType = "REGULAR";
    this.paymentMonth = paymentMonth;
    this.validColleagueLogin = validColleagueLogin;
    this.invalidLogin = "nonexistent_test_user_xyz_99";
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
