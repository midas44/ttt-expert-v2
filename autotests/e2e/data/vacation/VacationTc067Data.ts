declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  getEmployeeNotifInfo,
  findAvailableWeekFromServer,
} from "./queries/vacationNotificationQueries";

interface Tc067Args {
  employeeLogin: string;
  employeeEmail: string;
  approverEmail: string;
  startDate: string;
  endDate: string;
}

/**
 * TC-VAC-067: Cancel vacation → notification to approver.
 * Uses server clock for date calculation.
 */
export class VacationTc067Data {
  readonly employeeLogin: string;
  readonly employeeEmail: string;
  readonly approverEmail: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(args: Tc067Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeEmail = args.employeeEmail;
    this.approverEmail = args.approverEmail;
    this.startDate = args.startDate;
    this.endDate = args.endDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc067Data> {
    const defaults: Tc067Args = {
      employeeLogin: process.env.VAC_TC067_LOGIN ?? "pvaynmaster",
      employeeEmail: "Pavel.Weinmeister@noveogroup.com",
      approverEmail: "ivan.ilnitsky@noveogroup.com",
      startDate: "2026-06-22",
      endDate: "2026-06-26",
    };
    if (mode === "static") return new VacationTc067Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc067Args>("VacationTc067Data");
      if (cached) return new VacationTc067Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeNotifInfo(db, "pvaynmaster");
      const { startDate, endDate } = await findAvailableWeekFromServer(
        db, info.login, 9, 20,
      );

      const args: Tc067Args = {
        employeeLogin: info.login,
        employeeEmail: info.email,
        approverEmail: info.managerEmail,
        startDate,
        endDate,
      };

      saveToDisk("VacationTc067Data", args);
      return new VacationTc067Data(args);
    } finally {
      await db.close();
    }
  }
}
