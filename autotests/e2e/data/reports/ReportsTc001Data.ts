declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeForReporting,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc001Args {
  username: string;
  taskName: string;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-001: Create a time report — happy path.
 * Needs an employee with a task on their My Tasks grid and an empty cell
 * for a weekday in the current open period.
 */
export class ReportsTc001Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly hours = "4";

  constructor(
    username = process.env.RPT_TC001_USER ?? "pvaynmaster",
    taskName = "Development",
    dateLabel = "25.03",
    dateIso = "2026-03-25",
  ) {
    this.username = username;
    this.taskName = taskName;
    // Use first 40 chars to avoid UI truncation mismatches
    const shortName = taskName.substring(0, 40);
    this.taskPattern = new RegExp(
      shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    this.dateLabel = dateLabel;
    this.dateIso = dateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc001Data> {
    if (mode === "static") return new ReportsTc001Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc001Args>("ReportsTc001Data");
      if (cached) {
        return new ReportsTc001Data(
          cached.username,
          cached.taskName,
          cached.dateLabel,
          cached.dateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { dateLabel, dateIso } = getCurrentWeekday(2); // Wednesday
      const emp = await findEmployeeForReporting(db, dateIso);
      const args: Tc001Args = {
        username: emp.login,
        taskName: emp.taskName,
        dateLabel,
        dateIso,
      };
      saveToDisk("ReportsTc001Data", args);
      return new ReportsTc001Data(
        args.username,
        args.taskName,
        args.dateLabel,
        args.dateIso,
      );
    } finally {
      await db.close();
    }
  }
}
