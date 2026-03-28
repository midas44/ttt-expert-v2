declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeForReporting,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc002Args {
  username: string;
  taskName: string;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-002: Edit existing report — change hours.
 * Reuses the same employee/task query as TC-RPT-001 (finds empty cell).
 * The spec creates a 2h report as setup, then edits to 6h.
 */
export class ReportsTc002Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly setupHours = "2";
  readonly editHours = "6";

  constructor(
    username = process.env.RPT_TC002_USER ?? "pvaynmaster",
    taskName = "Development",
    dateLabel = "25.03",
    dateIso = "2026-03-25",
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
  ): Promise<ReportsTc002Data> {
    if (mode === "static") return new ReportsTc002Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc002Args>("ReportsTc002Data");
      if (cached) {
        return new ReportsTc002Data(
          cached.username,
          cached.taskName,
          cached.dateLabel,
          cached.dateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { dateLabel, dateIso } = getCurrentWeekday(1); // Tuesday
      const emp = await findEmployeeForReporting(db, dateIso);
      const args: Tc002Args = {
        username: emp.login,
        taskName: emp.taskName,
        dateLabel,
        dateIso,
      };
      if (mode === "saved") saveToDisk("ReportsTc002Data", args);
      return new ReportsTc002Data(
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
