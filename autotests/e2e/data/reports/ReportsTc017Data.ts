declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findManagerProjectEmployeeForConfirmation,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc017Args {
  managerLogin: string;
  employeeLogin: string;
  employeeName: string;
  projectName: string;
  taskName: string;
  taskId: number;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-017: Approve hours — By Employee tab.
 * Same data shape as TC-016 but test uses By Employee tab.
 * Includes employeeName for dropdown search (login doesn't work).
 */
export class ReportsTc017Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly employeeName: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly taskId: number;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly effort = 480;

  constructor(args: Partial<Tc017Args> = {}) {
    const weekday = getCurrentWeekday(1); // Tuesday
    this.managerLogin =
      args.managerLogin ?? process.env.RPT_TC017_MANAGER ?? "pvaynmaster";
    this.employeeLogin =
      args.employeeLogin ?? process.env.RPT_TC017_EMPLOYEE ?? "ivanov";
    this.employeeName = args.employeeName ?? "Ivanov";
    this.projectName = args.projectName ?? "TTT";
    this.taskName = args.taskName ?? "Development";
    this.taskId = args.taskId ?? 1;
    this.dateLabel = args.dateLabel ?? weekday.dateLabel;
    this.dateIso = args.dateIso ?? weekday.dateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc017Data> {
    if (mode === "static") return new ReportsTc017Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc017Args>("ReportsTc017Data");
      if (cached) return new ReportsTc017Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const weekday = getCurrentWeekday(1); // Tuesday
      const result = await findManagerProjectEmployeeForConfirmation(
        db,
        weekday.dateIso,
      );
      const args: Tc017Args = {
        managerLogin: result.managerLogin,
        employeeLogin: result.employeeLogin,
        employeeName: result.employeeName,
        projectName: result.projectName,
        taskName: result.taskName,
        taskId: result.taskId,
        dateLabel: weekday.dateLabel,
        dateIso: weekday.dateIso,
      };
      saveToDisk("ReportsTc017Data", args);
      return new ReportsTc017Data(args);
    } finally {
      await db.close();
    }
  }
}
