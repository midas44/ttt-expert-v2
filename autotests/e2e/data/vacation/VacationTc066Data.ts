declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  getEmployeeNotifInfo,
  findAvailableWeekFromServer,
} from "./queries/vacationNotificationQueries";

interface Tc066Args {
  employeeLogin: string;
  employeeEmail: string;
  startDate: string;
  endDate: string;
}

/**
 * TC-VAC-066: Reject vacation → notification to employee.
 * Uses server clock for date calculation.
 */
export class VacationTc066Data {
  readonly employeeLogin: string;
  readonly employeeEmail: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(args: Tc066Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeEmail = args.employeeEmail;
    this.startDate = args.startDate;
    this.endDate = args.endDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc066Data> {
    const defaults: Tc066Args = {
      employeeLogin: process.env.VAC_TC066_LOGIN ?? "pvaynmaster",
      employeeEmail: "Pavel.Weinmeister@noveogroup.com",
      startDate: "2026-06-15",
      endDate: "2026-06-19",
    };
    if (mode === "static") return new VacationTc066Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc066Args>("VacationTc066Data");
      if (cached) return new VacationTc066Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeNotifInfo(db, "pvaynmaster");
      const { startDate, endDate } = await findAvailableWeekFromServer(
        db, info.login, 8, 20,
      );

      const args: Tc066Args = {
        employeeLogin: info.login,
        employeeEmail: info.email,
        startDate,
        endDate,
      };

      saveToDisk("VacationTc066Data", args);
      return new VacationTc066Data(args);
    } finally {
      await db.close();
    }
  }
}
