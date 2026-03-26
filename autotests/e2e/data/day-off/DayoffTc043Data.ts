declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findNewDayoffRequestWithManager,
  createNewDayoffRequest,
  deleteTransferRequest,
} from "./queries/dayoffQueries";

interface Tc043Args {
  managerLogin: string;
  employeeName: string;
  requestId: number;
  originalDate: string;
  personalDate: string;
  createdByTest: boolean;
}

/**
 * TC-DO-043: APPROVER search type — requests pending my approval.
 *
 * Needs a NEW transfer request assigned to a manager for approval.
 * Tries to find an existing one first; creates via DB if none exists.
 * The test logs in as the manager and verifies the request appears
 * on the Approval tab with approve/reject actions.
 */
export class DayoffTc043Data {
  readonly managerLogin: string;
  readonly employeeName: string;
  readonly requestId: number;
  readonly originalDate: string;
  readonly personalDate: string;
  /** Whether the request was created by the test (needs cleanup). */
  readonly createdByTest: boolean;

  constructor(
    managerLogin = process.env.DAYOFF_TC043_MANAGER ?? "pvaynmaster",
    employeeName = "Test Employee",
    requestId = 0,
    originalDate = "2026-05-01",
    personalDate = "2026-05-15",
    createdByTest = false,
  ) {
    this.managerLogin = managerLogin;
    this.employeeName = employeeName;
    this.requestId = requestId;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
    this.createdByTest = createdByTest;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc043Data> {
    if (mode === "static") return new DayoffTc043Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc043Args>("DayoffTc043Data");
      if (cached)
        return new DayoffTc043Data(
          cached.managerLogin,
          cached.employeeName,
          cached.requestId,
          cached.originalDate,
          cached.personalDate,
          cached.createdByTest,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      // Try to find an existing NEW request with a manager
      const existing = await findNewDayoffRequestWithManager(db);
      if (existing) {
        const instance = new DayoffTc043Data(
          existing.managerLogin,
          existing.employeeName,
          existing.requestId,
          existing.originalDate,
          existing.personalDate,
          false,
        );
        if (mode === "saved")
          saveToDisk("DayoffTc043Data", {
            managerLogin: existing.managerLogin,
            employeeName: existing.employeeName,
            requestId: existing.requestId,
            originalDate: existing.originalDate,
            personalDate: existing.personalDate,
            createdByTest: false,
          });
        return instance;
      }

      // Fallback: create a NEW request
      const created = await createNewDayoffRequest(db);
      const instance = new DayoffTc043Data(
        created.managerLogin,
        created.employeeName,
        created.requestId,
        created.originalDate,
        created.personalDate,
        true,
      );
      if (mode === "saved")
        saveToDisk("DayoffTc043Data", {
          managerLogin: created.managerLogin,
          employeeName: created.employeeName,
          requestId: created.requestId,
          originalDate: created.originalDate,
          personalDate: created.personalDate,
          createdByTest: true,
        });
      return instance;
    } finally {
      await db.close();
    }
  }

  static async cleanup(
    requestId: number,
    createdByTest: boolean,
    tttConfig: TttConfig,
  ): Promise<void> {
    if (!createdByTest || !requestId) return;
    const db = new DbClient(tttConfig);
    try {
      await deleteTransferRequest(db, requestId);
    } finally {
      await db.close();
    }
  }

  /** Original date in DD.MM.YYYY for matching table content. */
  get originalDateDisplay(): string {
    const [y, m, d] = this.originalDate.split("-");
    return `${d}.${m}.${y}`;
  }
}
