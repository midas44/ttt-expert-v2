declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeForReporting, getCurrentWeekday } from "./queries/reportQueries";

interface Tc008Args {
  username: string;
  taskName: string;
}

/**
 * TC-RPT-008: Week navigation — arrow buttons.
 * Needs any employee with tasks to test week navigation.
 */
export class ReportsTc008Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;

  constructor(
    username = process.env.RPT_TC008_USER ?? "pvaynmaster",
    taskName = "Development",
  ) {
    this.username = username;
    this.taskName = taskName;
    const shortName = taskName.substring(0, 40);
    this.taskPattern = new RegExp(
      shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc008Data> {
    if (mode === "static") return new ReportsTc008Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc008Args>("ReportsTc008Data");
      if (cached) {
        return new ReportsTc008Data(cached.username, cached.taskName);
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { dateIso } = getCurrentWeekday(2);
      const emp = await findEmployeeForReporting(db, dateIso);
      const args: Tc008Args = {
        username: emp.login,
        taskName: emp.taskName,
      };
      saveToDisk("ReportsTc008Data", args);
      return new ReportsTc008Data(args.username, args.taskName);
    } finally {
      await db.close();
    }
  }
}
