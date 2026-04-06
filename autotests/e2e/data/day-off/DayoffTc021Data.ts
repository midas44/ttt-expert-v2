declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  findAnotherManager,
  createNewDayoffRequest,
} from "./queries/dayoffQueries";

interface Tc021Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
  targetManagerLogin: string;
  targetManagerFullName: string;
}

/**
 * TC-DO-021: Manager redirects a day-off transfer request to another manager.
 *
 * Strategy: find an existing NEW dayoff request with its manager,
 * then find a different manager to redirect to.
 */
export class DayoffTc021Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number;
  readonly targetManagerLogin: string;
  readonly targetManagerFullName: string;

  constructor(
    managerLogin = process.env.DAYOFF_TC021_MANAGER ?? "perekrest",
    employeeLogin = process.env.DAYOFF_TC021_EMPLOYEE ?? "ogribanova",
    employeeName = process.env.DAYOFF_TC021_EMP_NAME ?? "Грибанова Ольга",
    originalDate = process.env.DAYOFF_TC021_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC021_PERS ?? "2026-07-07",
    requestId = Number(process.env.DAYOFF_TC021_REQ_ID ?? "3405"),
    targetManagerLogin = process.env.DAYOFF_TC021_TARGET ?? "bryz",
    targetManagerFullName = process.env.DAYOFF_TC021_TARGET_NAME ??
      "Bryz",
  ) {
    this.managerLogin = managerLogin;
    this.employeeLogin = employeeLogin;
    this.employeeName = employeeName;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
    this.requestId = requestId;
    this.targetManagerLogin = targetManagerLogin;
    this.targetManagerFullName = targetManagerFullName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc021Data> {
    if (mode === "static") return new DayoffTc021Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc021Args>("DayoffTc021Data");
      if (cached)
        return new DayoffTc021Data(
          cached.managerLogin,
          cached.employeeLogin,
          cached.employeeName,
          cached.originalDate,
          cached.personalDate,
          cached.requestId,
          cached.targetManagerLogin,
          cached.targetManagerFullName,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      let row = await findNewDayoffRequestWithManager(db);
      if (!row) {
        // Pool exhausted (approve/reject tests consumed requests) — create one
        row = await createNewDayoffRequest(db);
      }

      const target = await findAnotherManager(db, row.managerLogin);

      const instance = new DayoffTc021Data(
        row.managerLogin,
        row.employeeLogin,
        row.employeeName,
        row.originalDate,
        row.personalDate,
        row.requestId,
        target.login,
        target.fullName,
      );

        saveToDisk("DayoffTc021Data", {
          managerLogin: row.managerLogin,
          employeeLogin: row.employeeLogin,
          employeeName: row.employeeName,
          originalDate: row.originalDate,
          personalDate: row.personalDate,
          requestId: row.requestId,
          targetManagerLogin: target.login,
          targetManagerFullName: target.fullName,
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
