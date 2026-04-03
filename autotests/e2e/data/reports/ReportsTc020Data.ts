declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findManagerProjectEmployeeForBulkApprove,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc020Args {
  managerLogin: string;
  employeeLogin: string;
  projectName: string;
  taskName: string;
  taskId: number;
  date1Label: string;
  date1Iso: string;
  date2Label: string;
  date2Iso: string;
}

/**
 * TC-RPT-020: Bulk approve — 'Approve all' header button.
 * Needs manager + employee + task with 2 free dates in the same week
 * so the test can create 2 reports and bulk-approve them.
 */
export class ReportsTc020Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly taskId: number;
  readonly date1Label: string;
  readonly date1Iso: string;
  readonly date2Label: string;
  readonly date2Iso: string;
  readonly effort = 120; // 2 hours per report

  constructor(args: Partial<Tc020Args> = {}) {
    const day1 = getCurrentWeekday(0); // Monday
    const day2 = getCurrentWeekday(2); // Wednesday
    this.managerLogin =
      args.managerLogin ?? process.env.RPT_TC020_MANAGER ?? "pvaynmaster";
    this.employeeLogin =
      args.employeeLogin ?? process.env.RPT_TC020_EMPLOYEE ?? "ivanov";
    this.projectName = args.projectName ?? "TTT";
    this.taskName = args.taskName ?? "Development";
    this.taskId = args.taskId ?? 1;
    this.date1Label = args.date1Label ?? day1.dateLabel;
    this.date1Iso = args.date1Iso ?? day1.dateIso;
    this.date2Label = args.date2Label ?? day2.dateLabel;
    this.date2Iso = args.date2Iso ?? day2.dateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc020Data> {
    if (mode === "static") return new ReportsTc020Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc020Args>("ReportsTc020Data");
      if (cached) return new ReportsTc020Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const day1 = getCurrentWeekday(0); // Monday
      const day2 = getCurrentWeekday(2); // Wednesday
      const result = await findManagerProjectEmployeeForBulkApprove(
        db,
        day1.dateIso,
        day2.dateIso,
      );
      const args: Tc020Args = {
        managerLogin: result.managerLogin,
        employeeLogin: result.employeeLogin,
        projectName: result.projectName,
        taskName: result.taskName,
        taskId: result.taskId,
        date1Label: day1.dateLabel,
        date1Iso: day1.dateIso,
        date2Label: day2.dateLabel,
        date2Iso: day2.dateIso,
      };
      if (mode === "saved") saveToDisk("ReportsTc020Data", args);
      return new ReportsTc020Data(args);
    } finally {
      await db.close();
    }
  }
}
