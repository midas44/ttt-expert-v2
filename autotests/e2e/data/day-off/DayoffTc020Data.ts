declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  createNewDayoffRequest,
} from "./queries/dayoffQueries";

interface Tc020Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
}

/**
 * TC-DO-020: Manager rejects a day-off transfer request.
 *
 * Strategy: find an existing NEW dayoff request along with its manager.
 * The manager logs in, navigates to the approval page, and clicks reject.
 */
export class DayoffTc020Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number;

  constructor(
    managerLogin = process.env.DAYOFF_TC020_MANAGER ?? "perekrest",
    employeeLogin = process.env.DAYOFF_TC020_EMPLOYEE ?? "adudkina",
    employeeName = process.env.DAYOFF_TC020_EMP_NAME ?? "Дудкина Анастасия",
    originalDate = process.env.DAYOFF_TC020_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC020_PERS ?? "2026-07-07",
    requestId = Number(process.env.DAYOFF_TC020_REQ_ID ?? "3411"),
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
  ): Promise<DayoffTc020Data> {
    if (mode === "static") return new DayoffTc020Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc020Args>("DayoffTc020Data");
      if (cached)
        return new DayoffTc020Data(
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

      const instance = new DayoffTc020Data(
        row.managerLogin,
        row.employeeLogin,
        row.employeeName,
        row.originalDate,
        row.personalDate,
        row.requestId,
      );

        saveToDisk("DayoffTc020Data", {
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

  /** Employee name pattern for table row matching (uses Russian full name). */
  get employeePattern(): RegExp {
    const lastName = this.employeeName.split(" ")[0];
    return new RegExp(lastName, "i");
  }
}
