declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  createNewDayoffRequest,
} from "./queries/dayoffQueries";

interface Tc022Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  requestId: number;
}

/**
 * TC-DO-022: Action buttons on NEW request — all 4 visible.
 *
 * Needs a NEW dayoff request visible on the manager's Approval tab.
 */
export class DayoffTc022Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly requestId: number;

  constructor(
    managerLogin = process.env.DAYOFF_TC022_MANAGER ?? "perekrest",
    employeeLogin = process.env.DAYOFF_TC022_EMPLOYEE ?? "ogribanova",
    employeeName = process.env.DAYOFF_TC022_EMP_NAME ?? "Грибанова Ольга",
    requestId = Number(process.env.DAYOFF_TC022_REQ_ID ?? "3405"),
  ) {
    this.managerLogin = managerLogin;
    this.employeeLogin = employeeLogin;
    this.employeeName = employeeName;
    this.requestId = requestId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc022Data> {
    if (mode === "static") return new DayoffTc022Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc022Args>("DayoffTc022Data");
      if (cached)
        return new DayoffTc022Data(
          cached.managerLogin,
          cached.employeeLogin,
          cached.employeeName,
          cached.requestId,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      let row = await findNewDayoffRequestWithManager(db);
      if (!row) {
        row = await createNewDayoffRequest(db);
      }

      const instance = new DayoffTc022Data(
        row.managerLogin,
        row.employeeLogin,
        row.employeeName,
        row.requestId,
      );

        saveToDisk("DayoffTc022Data", {
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
