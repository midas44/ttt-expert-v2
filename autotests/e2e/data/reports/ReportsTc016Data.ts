declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findManagerProjectEmployeeForConfirmation,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc016Args {
  managerLogin: string;
  employeeLogin: string;
  projectName: string;
  taskName: string;
  taskId: number;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-016: Approve hours — By Projects tab, single task.
 * Needs a manager (PM/ADMIN) and employee on the same project,
 * with no existing report for the target date.
 */
export class ReportsTc016Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly taskId: number;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly effort = 480; // 8 hours in minutes

  constructor(args: Partial<Tc016Args> = {}) {
    const weekday = getCurrentWeekday(2); // Wednesday
    this.managerLogin =
      args.managerLogin ?? process.env.RPT_TC016_MANAGER ?? "pvaynmaster";
    this.employeeLogin =
      args.employeeLogin ?? process.env.RPT_TC016_EMPLOYEE ?? "ivanov";
    this.projectName = args.projectName ?? "TTT";
    this.taskName = args.taskName ?? "Development";
    this.taskId = args.taskId ?? 1;
    this.dateLabel = args.dateLabel ?? weekday.dateLabel;
    this.dateIso = args.dateIso ?? weekday.dateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc016Data> {
    if (mode === "static") return new ReportsTc016Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc016Args>("ReportsTc016Data");
      if (cached) return new ReportsTc016Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const weekday = getCurrentWeekday(2); // Wednesday
      const result = await findManagerProjectEmployeeForConfirmation(
        db,
        weekday.dateIso,
      );
      const args: Tc016Args = {
        managerLogin: result.managerLogin,
        employeeLogin: result.employeeLogin,
        projectName: result.projectName,
        taskName: result.taskName,
        taskId: result.taskId,
        dateLabel: weekday.dateLabel,
        dateIso: weekday.dateIso,
      };
      if (mode === "saved") saveToDisk("ReportsTc016Data", args);
      return new ReportsTc016Data(args);
    } finally {
      await db.close();
    }
  }
}
