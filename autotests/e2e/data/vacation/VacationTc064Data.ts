declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  getEmployeeNotifInfo,
  findAvailableWeekFromServer,
} from "./queries/vacationNotificationQueries";

interface Tc064Args {
  employeeLogin: string;
  employeeEmail: string;
  approverEmail: string;
  startDate: string;
  endDate: string;
}

/**
 * TC-VAC-064: Create vacation → notification to approver.
 * Uses server clock for date calculation (QA env has manipulated test clock).
 */
export class VacationTc064Data {
  readonly employeeLogin: string;
  readonly employeeEmail: string;
  readonly approverEmail: string;
  readonly startDate: string;
  readonly endDate: string;

  constructor(args: Tc064Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeEmail = args.employeeEmail;
    this.approverEmail = args.approverEmail;
    this.startDate = args.startDate;
    this.endDate = args.endDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc064Data> {
    const defaults: Tc064Args = {
      employeeLogin: process.env.VAC_TC064_LOGIN ?? "pvaynmaster",
      employeeEmail: "Pavel.Weinmeister@noveogroup.com",
      approverEmail: "ivan.ilnitsky@noveogroup.com",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
    };
    if (mode === "static") return new VacationTc064Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc064Args>("VacationTc064Data");
      if (cached) return new VacationTc064Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeNotifInfo(db, "pvaynmaster");
      const { startDate, endDate } = await findAvailableWeekFromServer(
        db, info.login, 6, 20,
      );

      const args: Tc064Args = {
        employeeLogin: info.login,
        employeeEmail: info.email,
        approverEmail: info.managerEmail,
        startDate,
        endDate,
      };

      saveToDisk("VacationTc064Data", args);
      return new VacationTc064Data(args);
    } finally {
      await db.close();
    }
  }
}
