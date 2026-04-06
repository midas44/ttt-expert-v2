declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { createApprovedDayoffRequest } from "./queries/dayoffQueries";

interface Tc023Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  requestId: number;
}

/**
 * TC-DO-023: Action buttons on APPROVED request — only info visible.
 *
 * Always creates a fresh APPROVED request with a future original date
 * so it sorts to the top of the My department table (descending date sort),
 * guaranteeing visibility on page 1 without pagination issues.
 */
export class DayoffTc023Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly requestId: number;

  constructor(
    managerLogin = process.env.DAYOFF_TC023_MANAGER ?? "perekrest",
    employeeLogin = process.env.DAYOFF_TC023_EMPLOYEE ?? "ogribanova",
    employeeName = process.env.DAYOFF_TC023_EMP_NAME ?? "Грибанова Ольга",
    requestId = Number(process.env.DAYOFF_TC023_REQ_ID ?? "3410"),
  ) {
    this.managerLogin = managerLogin;
    this.employeeLogin = employeeLogin;
    this.employeeName = employeeName;
    this.requestId = requestId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc023Data> {
    if (mode === "static") return new DayoffTc023Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc023Args>("DayoffTc023Data");
      if (cached)
        return new DayoffTc023Data(
          cached.managerLogin,
          cached.employeeLogin,
          cached.employeeName,
          cached.requestId,
        );
    }

    // Always create fresh — guarantees future date (sorts to page 1)
    const db = new DbClient(tttConfig);
    try {
      const row = await createApprovedDayoffRequest(db);

      const instance = new DayoffTc023Data(
        row.managerLogin,
        row.employeeLogin,
        row.employeeName,
        row.requestId,
      );

        saveToDisk("DayoffTc023Data", {
          managerLogin: row.managerLogin,
          employeeLogin: row.employeeLogin,
          employeeName: row.employeeName,
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
