declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  getEmployeeNotifInfo,
  findAvailableWeekFromServer,
} from "./queries/vacationNotificationQueries";

interface Tc068Args {
  employeeLogin: string;
  employeeEmail: string;
  colleagueLogin: string;
  colleagueEmail: string;
  startDate: string;
  endDate: string;
}

/**
 * TC-VAC-068: Also-notify recipients receive notification.
 * Creates a vacation with notifyAlso containing a colleague,
 * then verifies notification email sent to the colleague.
 * Template: NOTIFY_VACATION_CREATE_TO_ALSO ("[TTT] Уведомление об отпуске сотрудника")
 */
export class VacationTc068Data {
  readonly employeeLogin: string;
  readonly employeeEmail: string;
  readonly colleagueLogin: string;
  readonly colleagueEmail: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(args: Tc068Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeEmail = args.employeeEmail;
    this.colleagueLogin = args.colleagueLogin;
    this.colleagueEmail = args.colleagueEmail;
    this.startDate = args.startDate;
    this.endDate = args.endDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc068Data> {
    const defaults: Tc068Args = {
      employeeLogin: process.env.VAC_TC068_LOGIN ?? "pvaynmaster",
      employeeEmail: "Pavel.Weinmeister@noveogroup.com",
      colleagueLogin: "iilnitsky",
      colleagueEmail: "ivan.ilnitsky@noveogroup.com",
      startDate: "2026-06-22",
      endDate: "2026-06-26",
    };
    if (mode === "static") return new VacationTc068Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc068Args>("VacationTc068Data");
      if (cached) return new VacationTc068Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeNotifInfo(db, "pvaynmaster");
      const { startDate, endDate } = await findAvailableWeekFromServer(
        db, info.login, 10, 20,
      );

      // Find a colleague (any enabled employee in the same office)
      const colleague = await db.queryOne<{
        login: string;
        email: string;
      }>(
        `SELECT e2.login, e2.email
         FROM ttt_vacation.employee e1
         JOIN ttt_vacation.employee e2
           ON e1.office_id = e2.office_id AND e1.id != e2.id
         WHERE e1.login = $1
           AND e2.enabled = true
           AND e2.email IS NOT NULL
           AND e2.email != ''
         ORDER BY random()
         LIMIT 1`,
        [info.login],
      );

      const args: Tc068Args = {
        employeeLogin: info.login,
        employeeEmail: info.email,
        colleagueLogin: colleague.login,
        colleagueEmail: colleague.email,
        startDate,
        endDate,
      };

      if (mode === "saved") saveToDisk("VacationTc068Data", args);
      return new VacationTc068Data(args);
    } finally {
      await db.close();
    }
  }
}
