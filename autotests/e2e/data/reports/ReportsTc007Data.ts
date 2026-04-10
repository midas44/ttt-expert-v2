declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeForReporting, getCurrentWeekday } from "./queries/reportQueries";

interface Tc007Args {
  username: string;
  taskName: string;
  taskId: number;
}

/**
 * TC-RPT-007: Rename task on My Tasks page.
 * Needs an employee with a visible (pinned) task that can be renamed.
 */
export class ReportsTc007Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly taskId: number;
  readonly renamedName: string;

  constructor(
    username = process.env.RPT_TC007_USER ?? "pvaynmaster",
    taskName = "Development",
    taskId = 0,
  ) {
    this.username = username;
    this.taskName = taskName;
    this.taskPattern = new RegExp(
      taskName.substring(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    this.taskId = taskId;
    this.renamedName = `${taskName} AT`;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc007Data> {
    if (mode === "static") return new ReportsTc007Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc007Args>("ReportsTc007Data");
      if (cached) {
        return new ReportsTc007Data(
          cached.username,
          cached.taskName,
          cached.taskId,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { dateIso } = getCurrentWeekday(2);
      const emp = await findEmployeeForReporting(db, dateIso);
      const args: Tc007Args = {
        username: emp.login,
        taskName: emp.taskName,
        taskId: emp.taskId,
      };
      saveToDisk("ReportsTc007Data", args);
      return new ReportsTc007Data(args.username, args.taskName, args.taskId);
    } finally {
      await db.close();
    }
  }
}
