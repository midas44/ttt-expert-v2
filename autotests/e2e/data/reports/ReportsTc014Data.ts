declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findManagerAndEmployee } from "./queries/reportQueries";

interface Tc014Args {
  managerLogin: string;
  employeeLogin: string;
}

/**
 * TC-RPT-014: View another employee's report page (manager).
 * Needs a manager (PM/ADMIN) and a random employee with pinned tasks.
 */
export class ReportsTc014Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;

  constructor(
    managerLogin = process.env.RPT_TC014_MANAGER ?? "pvaynmaster",
    employeeLogin = process.env.RPT_TC014_EMPLOYEE ?? "ivanov",
  ) {
    this.managerLogin = managerLogin;
    this.employeeLogin = employeeLogin;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc014Data> {
    if (mode === "static") return new ReportsTc014Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc014Args>("ReportsTc014Data");
      if (cached) {
        return new ReportsTc014Data(cached.managerLogin, cached.employeeLogin);
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const result = await findManagerAndEmployee(db);
      const args: Tc014Args = {
        managerLogin: result.managerLogin,
        employeeLogin: result.employeeLogin,
      };
      if (mode === "saved") saveToDisk("ReportsTc014Data", args);
      return new ReportsTc014Data(args.managerLogin, args.employeeLogin);
    } finally {
      await db.close();
    }
  }
}
