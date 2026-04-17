declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findEmployeeForReporting,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc010Args {
  username: string;
  taskName: string;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-010: Report with decimal hours (e.g., 1.5).
 * Same data needs as TC-RPT-001 but the value is "1.5" (90 minutes).
 */
export class ReportsTc010Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly hours = "1.5";

  constructor(
    username = process.env.RPT_TC010_USER ?? "pvaynmaster",
    taskName = "Development",
    dateLabel = "26.03",
    dateIso = "2026-03-26",
  ) {
    this.username = username;
    this.taskName = taskName;
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
  ): Promise<ReportsTc010Data> {
    if (mode === "static") return new ReportsTc010Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc010Args>("ReportsTc010Data");
      if (cached) {
        return new ReportsTc010Data(
          cached.username,
          cached.taskName,
          cached.dateLabel,
          cached.dateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      // Use Thursday (offset 3) to avoid collision with TC-RPT-001 (Wed)
      const { dateLabel, dateIso } = getCurrentWeekday(3);
      const emp = await findEmployeeForReporting(db, dateIso);
      const args: Tc010Args = {
        username: emp.login,
        taskName: emp.taskName,
        dateLabel,
        dateIso,
      };
      saveToDisk("ReportsTc010Data", args);
      return new ReportsTc010Data(
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
