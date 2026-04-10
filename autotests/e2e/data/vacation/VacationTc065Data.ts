declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  getEmployeeNotifInfo,
  findAvailableWeekFromServer,
} from "./queries/vacationNotificationQueries";

interface Tc065Args {
  employeeLogin: string;
  employeeEmail: string;
  approverEmail: string;
  startDate: string;
  endDate: string;
}

/**
 * TC-VAC-065: Approve vacation → notification to employee.
 * Uses server clock for date calculation.
 */
export class VacationTc065Data {
  readonly employeeLogin: string;
  readonly employeeEmail: string;
  readonly approverEmail: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(args: Tc065Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeEmail = args.employeeEmail;
    this.approverEmail = args.approverEmail;
    this.startDate = args.startDate;
    this.endDate = args.endDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc065Data> {
    const defaults: Tc065Args = {
      employeeLogin: process.env.VAC_TC065_LOGIN ?? "pvaynmaster",
      employeeEmail: "Pavel.Weinmeister@noveogroup.com",
      approverEmail: "ivan.ilnitsky@noveogroup.com",
      startDate: "2026-06-08",
      endDate: "2026-06-12",
    };
    if (mode === "static") return new VacationTc065Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc065Args>("VacationTc065Data");
      if (cached) return new VacationTc065Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeNotifInfo(db, "pvaynmaster");
      const { startDate, endDate } = await findAvailableWeekFromServer(
        db, info.login, 7, 20,
      );

      const args: Tc065Args = {
        employeeLogin: info.login,
        employeeEmail: info.email,
        approverEmail: info.managerEmail,
        startDate,
        endDate,
      };

      saveToDisk("VacationTc065Data", args);
      return new VacationTc065Data(args);
    } finally {
      await db.close();
    }
  }
}
