declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  createNewDayoffRequest,
} from "./queries/dayoffQueries";
import { getEmployeeNotifInfo } from "../vacation/queries/vacationNotificationQueries";

interface Tc069Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  employeeEmail: string;
  requestId: number;
  originalDate: string;
  personalDate: string;
}

/**
 * TC-DO-069: Email notification sent on day-off approval.
 *
 * Finds or creates a NEW transfer request with a manager who can approve it.
 * After approval, the test checks ttt_email for the notification to the employee.
 * Template: NOTIFY_DAYOFF_STATUS_CHANGE_TO_EMPLOYEE
 */
export class DayoffTc069Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly employeeEmail: string;
  readonly requestId: number;
  readonly originalDate: string;
  readonly personalDate: string;

  constructor(args: Tc069Args) {
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
  ): Promise<DayoffTc069Data> {
    const defaults: Tc069Args = {
      managerLogin: process.env.DAYOFF_TC069_MANAGER ?? "perekrest",
      employeeLogin: process.env.DAYOFF_TC069_EMPLOYEE ?? "ogribanova",
      employeeName: "Грибанова Ольга",
      employeeEmail: "olga.gribanova@noveogroup.com",
      requestId: 0,
      originalDate: "2026-05-01",
      personalDate: "2026-07-07",
    };
    if (mode === "static") return new DayoffTc069Data(defaults);

    if (mode === "saved") {
      const cached = loadSaved<Tc069Args>("DayoffTc069Data");
      if (cached) return new DayoffTc069Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      // Always create a fresh NEW request to guarantee a clean state
      const row = await createNewDayoffRequest(db);
      const notifInfo = await getEmployeeNotifInfo(db, row.employeeLogin);

      const args: Tc069Args = {
        managerLogin: row.managerLogin,
        employeeLogin: row.employeeLogin,
        employeeName: row.employeeName,
        employeeEmail: notifInfo.email,
        requestId: row.requestId,
        originalDate: row.originalDate,
        personalDate: row.personalDate,
      };

      if (mode === "saved") saveToDisk("DayoffTc069Data", args);
      return new DayoffTc069Data(args);
    } finally {
      await db.close();
    }
  }

  get employeePattern(): RegExp {
    const lastName = this.employeeName.split(" ")[0];
    return new RegExp(lastName, "i");
  }
}
