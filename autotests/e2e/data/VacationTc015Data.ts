declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-015: Create with null optionalApprovers — NPE bug (CPO path)
 *
 * Preconditions: CPO employee (ROLE_DEPARTMENT_MANAGER)
 * Expected: KNOWN BUG — HTTP 500 NullPointerException at
 *   VacationServiceImpl:155 — CPO path calls getOptionalApprovers().add(manager)
 *   on null list.
 * If fixed: Vacation created (null treated as empty) or 400 validation error.
 *
 * Workaround: send optionalApprovers: [] instead of omitting.
 * Non-CPO path has a null check in synchronizeOptionalApprovals, so it may survive.
 */
export class VacationTc015Data {
  readonly login: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  // optionalApprovers deliberately absent — this IS the test
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc015Data> {
    if (mode === "static") return new VacationTc015Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
      }>("VacationTc015Data");
      if (cached)
        return new VacationTc015Data(
          cached.login,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC015_LOGIN ?? "pvaynmaster";

      // Verify CPO role (ROLE_DEPARTMENT_MANAGER)
      const roleCheck = await db.queryOne<{ cnt: string }>(
        `SELECT count(*)::text AS cnt
         FROM ttt_backend.employee e
         JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
         WHERE e.login = $1 AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'`,
        [login],
      );
      if (Number(roleCheck.cnt) === 0) {
        throw new Error(
          `User "${login}" does not have ROLE_DEPARTMENT_MANAGER — TC-VAC-015 requires CPO`,
        );
      }

      // Find conflict-free Mon-Fri window
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
          const instance = new VacationTc015Data(
            login,
            startIso,
            endIso,
            paymentMonth,
          );
          if (mode === "saved")
            saveToDisk("VacationTc015Data", {
              login,
              startDate: startIso,
              endDate: endIso,
              paymentMonth,
            });
          return instance;
        }
      }
      throw new Error(
        `Could not find conflict-free Mon-Fri window for "${login}"`,
      );
    } finally {
      await db.close();
    }
  }

  constructor(
    login = "pvaynmaster",
    startDate = "2026-06-15",
    endDate = "2026-06-19",
    paymentMonth = "2026-06-01",
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
