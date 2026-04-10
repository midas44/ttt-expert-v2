declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { createNewDayoffRequest } from "./queries/dayoffQueries";
import { getEmployeeNotifInfo } from "../vacation/queries/vacationNotificationQueries";

interface Tc070Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  employeeEmail: string;
  requestId: number;
  originalDate: string;
  personalDate: string;
}

/**
 * TC-DO-070: Email notification sent on day-off rejection.
 *
 * Creates a NEW transfer request, has manager reject it,
 * then verifies the employee receives a notification email.
 * Template: NOTIFY_DAYOFF_STATUS_CHANGE_TO_EMPLOYEE (action=rejected)
 */
export class DayoffTc070Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly employeeEmail: string;
  readonly requestId: number;
  readonly originalDate: string;
  readonly personalDate: string;

  constructor(args: Tc070Args) {
    this.managerLogin = args.managerLogin;
    this.employeeLogin = args.employeeLogin;
    this.employeeName = args.employeeName;
    this.employeeEmail = args.employeeEmail;
    this.requestId = args.requestId;
    this.originalDate = args.originalDate;
    this.personalDate = args.personalDate;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc070Data> {
    const defaults: Tc070Args = {
      managerLogin: process.env.DAYOFF_TC070_MANAGER ?? "perekrest",
      employeeLogin: process.env.DAYOFF_TC070_EMPLOYEE ?? "ogribanova",
      employeeName: "Грибанова Ольга",
      employeeEmail: "olga.gribanova@noveogroup.com",
      requestId: 0,
      originalDate: "2026-05-01",
      personalDate: "2026-07-07",
    };
    if (mode === "static") return new DayoffTc070Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc070Args>("DayoffTc070Data");
      if (cached) return new DayoffTc070Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await createNewDayoffRequest(db);
      const notifInfo = await getEmployeeNotifInfo(db, row.employeeLogin);

      const args: Tc070Args = {
        managerLogin: row.managerLogin,
        employeeLogin: row.employeeLogin,
        employeeName: row.employeeName,
        employeeEmail: notifInfo.email,
        requestId: row.requestId,
        originalDate: row.originalDate,
        personalDate: row.personalDate,
      };

      saveToDisk("DayoffTc070Data", args);
      return new DayoffTc070Data(args);
    } finally {
      await db.close();
    }
  }

  get employeePattern(): RegExp {
    const lastName = this.employeeName.split(" ")[0];
    return new RegExp(lastName, "i");
  }
}
