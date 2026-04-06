declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  getEmployeeNotifInfo,
  findAvailableWeekFromServer,
} from "./queries/vacationNotificationQueries";

interface Tc069Args {
  employeeLogin: string;
  employeeEmail: string;
  approverEmail: string;
  startDate: string;
  endDate: string;
  paymentMonth: string;
}

/**
 * TC-VAC-069: Wrong payment month in notification (#2925).
 * Creates a vacation with a specific paymentMonth, approves it,
 * then checks the notification email body for the correct payment month.
 * Regression test for open bug #2925.
 */
export class VacationTc069Data {
  readonly employeeLogin: string;
  readonly employeeEmail: string;
  readonly approverEmail: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly paymentMonth: string;

  constructor(args: Tc069Args) {
    this.employeeLogin = args.employeeLogin;
    this.employeeEmail = args.employeeEmail;
    this.approverEmail = args.approverEmail;
    this.startDate = args.startDate;
    this.endDate = args.endDate;
    this.paymentMonth = args.paymentMonth;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<VacationTc069Data> {
    const defaults: Tc069Args = {
      employeeLogin: process.env.VAC_TC069_LOGIN ?? "pvaynmaster",
      employeeEmail: "Pavel.Weinmeister@noveogroup.com",
      approverEmail: "ivan.ilnitsky@noveogroup.com",
      startDate: "2026-07-06",
      endDate: "2026-07-10",
      paymentMonth: "2026-07-01",
    };
    if (mode === "static") return new VacationTc069Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc069Args>("VacationTc069Data");
      if (cached) return new VacationTc069Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const info = await getEmployeeNotifInfo(db, "pvaynmaster");
      const { startDate, endDate } = await findAvailableWeekFromServer(
        db, info.login, 11, 20,
      );

      // paymentMonth = first day of the vacation start month
      const paymentMonth = startDate.slice(0, 8) + "01";

      const args: Tc069Args = {
        employeeLogin: info.login,
        employeeEmail: info.email,
        approverEmail: info.managerEmail,
        startDate,
        endDate,
        paymentMonth,
      };

      saveToDisk("VacationTc069Data", args);
      return new VacationTc069Data(args);
    } finally {
      await db.close();
    }
  }
}
