declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  createNewDayoffRequest,
} from "./queries/dayoffQueries";

interface Tc018Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
}

/**
 * TC-DO-018: Manager approves a day-off transfer request.
 *
 * Strategy: find an existing NEW dayoff request along with its manager.
 * The manager (ROLE_PROJECT_MANAGER+) logs in, navigates to the approval page,
 * and clicks approve on the request row.
 */
export class DayoffTc018Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number;

  constructor(
    managerLogin = process.env.DAYOFF_TC018_MANAGER ?? "perekrest",
    employeeLogin = process.env.DAYOFF_TC018_EMPLOYEE ?? "ogribanova",
    employeeName = process.env.DAYOFF_TC018_EMP_NAME ?? "Грибанова Ольга",
    originalDate = process.env.DAYOFF_TC018_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC018_PERS ?? "2026-07-07",
    requestId = Number(process.env.DAYOFF_TC018_REQ_ID ?? "3405"),
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
  ): Promise<DayoffTc018Data> {
    if (mode === "static") return new DayoffTc018Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc018Args>("DayoffTc018Data");
      if (cached)
        return new DayoffTc018Data(
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

      const instance = new DayoffTc018Data(
        row.managerLogin,
        row.employeeLogin,
        row.employeeName,
        row.originalDate,
        row.personalDate,
        row.requestId,
      );

        saveToDisk("DayoffTc018Data", {
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
    // The approval table shows Russian full name "Фамилия Имя"
    // Match the last name (first word) for reliability
    const lastName = this.employeeName.split(" ")[0];
    return new RegExp(lastName, "i");
  }
}
