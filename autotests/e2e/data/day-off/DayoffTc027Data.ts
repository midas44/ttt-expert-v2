declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  createNewDayoffRequest,
} from "./queries/dayoffQueries";

interface Tc027Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  requestId: number;
}

/**
 * TC-DO-027: Main action buttons disabled during Edit list mode.
 *
 * Manager opens modal, clicks "Edit list", verifies action buttons are disabled,
 * clicks Cancel, verifies they re-enable.
 */
export class DayoffTc027Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly requestId: number;

  constructor(
    managerLogin = process.env.DAYOFF_TC027_MANAGER ?? "perekrest",
    employeeLogin = process.env.DAYOFF_TC027_EMPLOYEE ?? "ogribanova",
    employeeName = process.env.DAYOFF_TC027_EMP_NAME ?? "Грибанова Ольга",
    requestId = Number(process.env.DAYOFF_TC027_REQ_ID ?? "3405"),
  ) {
    this.managerLogin = managerLogin;
    this.employeeLogin = employeeLogin;
    this.employeeName = employeeName;
    this.requestId = requestId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc027Data> {
    if (mode === "static") return new DayoffTc027Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc027Args>("DayoffTc027Data");
      if (cached)
        return new DayoffTc027Data(
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

      const instance = new DayoffTc027Data(
        row.managerLogin,
        row.employeeLogin,
        row.employeeName,
        row.requestId,
      );

      if (mode === "saved")
        saveToDisk("DayoffTc027Data", {
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
