declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeForReporting,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc012Args {
  username: string;
  taskName: string;
  taskId: number;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-012: Report comment — add and view.
 * Needs an employee with a pinned task and an open cell to fill a report,
 * then add a comment and verify the tooltip.
 */
export class ReportsTc012Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly taskId: number;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly hours = "4";
  readonly comment = "Code review for feature X";

  constructor(
    username = process.env.RPT_TC012_USER ?? "pvaynmaster",
    taskName = "Development",
    taskId = 0,
    dateLabel = "01.04",
    dateIso = "2026-04-01",
  ) {
    this.username = username;
    this.taskName = taskName;
    this.taskPattern = new RegExp(
      taskName.substring(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    this.taskId = taskId;
    this.dateLabel = dateLabel;
    this.dateIso = dateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc012Data> {
    if (mode === "static") return new ReportsTc012Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc012Args>("ReportsTc012Data");
      if (cached) {
        return new ReportsTc012Data(
          cached.username,
          cached.taskName,
          cached.taskId,
          cached.dateLabel,
          cached.dateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { dateLabel, dateIso } = getCurrentWeekday(2);
      const emp = await findEmployeeForReporting(db, dateIso);
      const args: Tc012Args = {
        username: emp.login,
        taskName: emp.taskName,
        taskId: emp.taskId,
        dateLabel,
        dateIso,
      };
      saveToDisk("ReportsTc012Data", args);
      return new ReportsTc012Data(
        args.username,
        args.taskName,
        args.taskId,
        args.dateLabel,
        args.dateIso,
      );
    } finally {
      await db.close();
    }
  }
}
