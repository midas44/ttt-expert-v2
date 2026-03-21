declare const process: { env: Record<string, string | undefined> };

import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { hasVacationConflict } from "./queries/vacationQueries";
import { loadSaved, saveToDisk } from "./savedDataStore";

/**
 * TC-VAC-018: Create vacation — CPO auto-approver self-assignment
 *
 * Preconditions:
 * - CPO/DM employee (ROLE_DEPARTMENT_MANAGER) with a manager
 * - Sufficient available days, conflict-free dates
 * Expected:
 * - Vacation created successfully
 * - approverId = employee's own ID (self-approval)
 * - Employee's manager added as optional approver with status ASKED
 *
 * CPO pattern: self-approve + manager as optional approver.
 * Vault: vacation-service-deep-dive.md § CRUD orchestration
 */
export class VacationTc018Data {
  readonly login: string;
  readonly managerLogin: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentType: string;
  readonly paymentMonth: string;
  readonly authHeaderName: string;
  readonly vacationEndpoint: string;

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc018Data> {
    if (mode === "static") return new VacationTc018Data();
    if (mode === "saved") {
      const cached = loadSaved<{
        login: string;
        managerLogin: string;
        startDate: string;
        endDate: string;
        paymentMonth: string;
      }>("VacationTc018Data");
      if (cached)
        return new VacationTc018Data(
          cached.login,
          cached.managerLogin,
          cached.startDate,
          cached.endDate,
          cached.paymentMonth,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const login = process.env.VACATION_TC018_LOGIN ?? "pvaynmaster";

      // Verify CPO role + has manager
      const empRow = await db.queryOne<{
        manager_login: string;
      }>(
        `SELECT mgr.login AS manager_login
         FROM ttt_backend.employee e
         JOIN ttt_backend.employee_global_roles r ON r.employee = e.id
         JOIN ttt_backend.employee mgr ON mgr.id = e.senior_manager
         WHERE e.login = $1
           AND r.role_name = 'ROLE_DEPARTMENT_MANAGER'
           AND e.senior_manager IS NOT NULL`,
        [login],
      );
      const managerLogin = empRow.manager_login;

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
          const instance = new VacationTc018Data(
            login,
            managerLogin,
            startIso,
            endIso,
            paymentMonth,
          );
          if (mode === "saved")
            saveToDisk("VacationTc018Data", {
              login,
              managerLogin,
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
    managerLogin = "manager_placeholder",
    startDate = "2026-07-20",
    endDate = "2026-07-24",
    paymentMonth = "2026-07-01",
  ) {
    this.login = login;
    this.managerLogin = managerLogin;
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
