declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findManagerProjectEmployeeForConfirmation,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc018Args {
  managerLogin: string;
  employeeLogin: string;
  projectName: string;
  taskName: string;
  taskId: number;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-018: Reject hours with comment.
 * Needs a manager + employee on same project (same as TC-016).
 */
export class ReportsTc018Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly taskId: number;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly effort = 480;
  readonly rejectComment = "Please split by subtasks";

  constructor(args: Partial<Tc018Args> = {}) {
    const weekday = getCurrentWeekday(3); // Thursday
    this.managerLogin =
      args.managerLogin ?? process.env.RPT_TC018_MANAGER ?? "pvaynmaster";
    this.employeeLogin =
      args.employeeLogin ?? process.env.RPT_TC018_EMPLOYEE ?? "ivanov";
    this.projectName = args.projectName ?? "TTT";
    this.taskName = args.taskName ?? "Development";
    this.taskId = args.taskId ?? 1;
    this.dateLabel = args.dateLabel ?? weekday.dateLabel;
    this.dateIso = args.dateIso ?? weekday.dateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc018Data> {
    if (mode === "static") return new ReportsTc018Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc018Args>("ReportsTc018Data");
      if (cached) return new ReportsTc018Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const weekday = getCurrentWeekday(3); // Thursday
      const result = await findManagerProjectEmployeeForConfirmation(
        db,
        weekday.dateIso,
      );
      const args: Tc018Args = {
        managerLogin: result.managerLogin,
        employeeLogin: result.employeeLogin,
        projectName: result.projectName,
        taskName: result.taskName,
        taskId: result.taskId,
        dateLabel: weekday.dateLabel,
        dateIso: weekday.dateIso,
      };
      saveToDisk("ReportsTc018Data", args);
      return new ReportsTc018Data(args);
    } finally {
      await db.close();
    }
  }
}
