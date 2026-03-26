declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "./savedDataStore";
import type { TestDataMode } from "../config/configUtils";
import type { TttConfig } from "../config/tttConfig";
import { DbClient } from "../config/db/dbClient";
import { createCpoSelfAssignedRequest } from "./queries/dayoffQueries";

interface Tc030Args {
  cpoLogin: string;
  cpoName: string;
  originalDate: string;
  personalDate: string;
  requestId: number;
}

/**
 * TC-DO-030: CPO self-approval (PROJECT role).
 *
 * Creates a day-off request for a CPO/department manager with approver=self.
 * The CPO then self-approves via the Approval tab.
 */
export class DayoffTc030Data {
  readonly cpoLogin: string;
  readonly cpoName: string;
  readonly originalDate: string;
  readonly personalDate: string;
  readonly requestId: number;

  constructor(
    cpoLogin = process.env.DAYOFF_TC030_CPO ?? "pvaynmaster",
    cpoName = process.env.DAYOFF_TC030_CPO_NAME ?? "Вейнмастер Полина",
    originalDate = process.env.DAYOFF_TC030_ORIG ?? "2026-05-01",
    personalDate = process.env.DAYOFF_TC030_PERS ?? "2026-07-07",
    requestId = Number(process.env.DAYOFF_TC030_REQ_ID ?? "3420"),
  ) {
    this.cpoLogin = cpoLogin;
    this.cpoName = cpoName;
    this.originalDate = originalDate;
    this.personalDate = personalDate;
    this.requestId = requestId;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<DayoffTc030Data> {
    if (mode === "static") return new DayoffTc030Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc030Args>("DayoffTc030Data");
      if (cached)
        return new DayoffTc030Data(
          cached.cpoLogin,
          cached.cpoName,
          cached.originalDate,
          cached.personalDate,
          cached.requestId,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await createCpoSelfAssignedRequest(db);

      const instance = new DayoffTc030Data(
        row.cpoLogin,
        row.cpoName,
        row.originalDate,
        row.personalDate,
        row.requestId,
      );

      if (mode === "saved")
        saveToDisk("DayoffTc030Data", {
          cpoLogin: row.cpoLogin,
          cpoName: row.cpoName,
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
    const lastName = this.cpoName.split(" ")[0];
    return new RegExp(lastName, "i");
  }
}
