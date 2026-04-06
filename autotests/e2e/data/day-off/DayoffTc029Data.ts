declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { createApprovedDayoffRequest } from "./queries/dayoffQueries";

interface Tc029Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
}

/**
 * TC-DO-029: Approve then reject an approved request.
 *
 * Creates an APPROVED request with a future personalDate.
 * The manager then rejects it via the modal on the My department tab.
 */
export class DayoffTc029Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number;

  constructor(
    managerLogin = process.env.DAYOFF_TC029_MANAGER ?? "perekrest",
    employeeLogin = process.env.DAYOFF_TC029_EMPLOYEE ?? "ogribanova",
    employeeName = process.env.DAYOFF_TC029_EMP_NAME ?? "Грибанова Ольга",
    originalDate = process.env.DAYOFF_TC029_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC029_PERS ?? "2026-07-07",
    requestId = Number(process.env.DAYOFF_TC029_REQ_ID ?? "3410"),
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
  ): Promise<DayoffTc029Data> {
    if (mode === "static") return new DayoffTc029Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc029Args>("DayoffTc029Data");
      if (cached)
        return new DayoffTc029Data(
          cached.managerLogin,
          cached.employeeLogin,
          cached.employeeName,
          cached.originalDate,
          cached.personalDate,
          cached.requestId,
        );
    }

    // Always create fresh APPROVED request with future dates
    const db = new DbClient(tttConfig);
    try {
      const row = await createApprovedDayoffRequest(db);

      const instance = new DayoffTc029Data(
        row.managerLogin,
        row.employeeLogin,
        row.employeeName,
        row.originalDate,
        row.personalDate,
        row.requestId,
      );

        saveToDisk("DayoffTc029Data", {
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
