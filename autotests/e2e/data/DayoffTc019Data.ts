declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "./savedDataStore";
import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  createNewDayoffRequest,
} from "./queries/dayoffQueries";

interface Tc019Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
}

/**
 * TC-DO-019: Approve transfer request via modal button.
 *
 * Manager opens the WeekendDetailsModal and clicks Approve inside it.
 */
export class DayoffTc019Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number;

  constructor(
    managerLogin = process.env.DAYOFF_TC019_MANAGER ?? "perekrest",
    employeeLogin = process.env.DAYOFF_TC019_EMPLOYEE ?? "ogribanova",
    employeeName = process.env.DAYOFF_TC019_EMP_NAME ?? "Грибанова Ольга",
    originalDate = process.env.DAYOFF_TC019_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC019_PERS ?? "2026-07-07",
    requestId = Number(process.env.DAYOFF_TC019_REQ_ID ?? "3405"),
  ) {
    this.managerLogin = managerLogin;
    this.employeeLogin = employeeLogin;
    this.employeeName = employeeName;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
    this.requestId = requestId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc019Data> {
    if (mode === "static") return new DayoffTc019Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc019Args>("DayoffTc019Data");
      if (cached)
        return new DayoffTc019Data(
          cached.managerLogin,
          cached.employeeLogin,
          cached.employeeName,
          cached.originalDate,
          cached.personalDate,
          cached.requestId,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      let row = await findNewDayoffRequestWithManager(db);
      if (!row) {
        row = await createNewDayoffRequest(db);
      }

      const instance = new DayoffTc019Data(
        row.managerLogin,
        row.employeeLogin,
        row.employeeName,
        row.originalDate,
        row.personalDate,
        row.requestId,
      );

      if (mode === "saved")
        saveToDisk("DayoffTc019Data", {
          managerLogin: row.managerLogin,
          employeeLogin: row.employeeLogin,
          employeeName: row.employeeName,
          originalDate: row.originalDate,
          personalDate: row.personalDate,
          requestId: row.requestId,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  get employeePattern(): RegExp {
    const lastName = this.employeeName.split(" ")[0];
    return new RegExp(lastName, "i");
  }
}
