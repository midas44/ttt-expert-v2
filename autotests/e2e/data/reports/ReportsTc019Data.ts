declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findManagerProjectEmployeeForConfirmation,
  getCurrentWeekday,
  stripProjectPrefix,
} from "./queries/reportQueries";

interface Tc019Args {
  managerLogin: string;
  employeeLogin: string;
  projectName: string;
  taskName: string;
  taskDisplayName: string;
  taskId: number;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-019: Re-report after rejection — clears rejected state.
 * Needs manager + employee on same project. SETUP will create & reject a report.
 * Employee then re-reports via My Tasks page.
 */
export class ReportsTc019Data {
  readonly managerLogin: string;
  readonly employeeLogin: string;
  readonly projectName: string;
  readonly taskName: string;
  /** Task name as displayed on My Tasks page (project prefix stripped when "Group by project" is on). */
  readonly taskDisplayName: string;
  readonly taskId: number;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly setupEffort = 240; // 4 hours
  readonly editEffort = "6"; // new value employee types in cell

  constructor(args: Partial<Tc019Args> = {}) {
    const weekday = getCurrentWeekday(0); // Monday
    this.managerLogin =
      args.managerLogin ?? process.env.RPT_TC019_MANAGER ?? "pvaynmaster";
    this.employeeLogin =
      args.employeeLogin ?? process.env.RPT_TC019_EMPLOYEE ?? "ivanov";
    this.projectName = args.projectName ?? "TTT";
    this.taskName = args.taskName ?? "Development";
    this.taskDisplayName = args.taskDisplayName ?? stripProjectPrefix(this.taskName, this.projectName);
    this.taskId = args.taskId ?? 1;
    this.dateLabel = args.dateLabel ?? weekday.dateLabel;
    this.dateIso = args.dateIso ?? weekday.dateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc019Data> {
    if (mode === "static") return new ReportsTc019Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc019Args>("ReportsTc019Data");
      if (cached) return new ReportsTc019Data(cached);
    }

    const db = new DbClient(tttConfig);
    try {
      const weekday = getCurrentWeekday(0); // Monday
      const result = await findManagerProjectEmployeeForConfirmation(
        db,
        weekday.dateIso,
      );
      const args: Tc019Args = {
        managerLogin: result.managerLogin,
        employeeLogin: result.employeeLogin,
        projectName: result.projectName,
        taskName: result.taskName,
        taskDisplayName: stripProjectPrefix(result.taskName, result.projectName),
        taskId: result.taskId,
        dateLabel: weekday.dateLabel,
        dateIso: weekday.dateIso,
      };
      if (mode === "saved") saveToDisk("ReportsTc019Data", args);
      return new ReportsTc019Data(args);
    } finally {
      await db.close();
    }
  }
}
