declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findEmployeeForReporting,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc003Args {
  username: string;
  taskName: string;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-003: Delete report by setting hours to 0.
 * Creates a 3h report as setup, then sets to 0 — verifies cell is empty (deleted).
 * Uses Thursday (dayOffset=3) to avoid collision with TC-RPT-001 (Wed) and TC-RPT-002 (Tue).
 */
export class ReportsTc003Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly dateLabel: string;
  readonly dateIso: string;
  readonly setupHours = "3";

  constructor(
    username = process.env.RPT_TC003_USER ?? "pvaynmaster",
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
  ): Promise<ReportsTc003Data> {
    if (mode === "static") return new ReportsTc003Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc003Args>("ReportsTc003Data");
      if (cached) {
        return new ReportsTc003Data(
          cached.username,
          cached.taskName,
          cached.dateLabel,
          cached.dateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const { dateLabel, dateIso } = getCurrentWeekday(3); // Thursday
      const emp = await findEmployeeForReporting(db, dateIso);
      const args: Tc003Args = {
        username: emp.login,
        taskName: emp.taskName,
        dateLabel,
        dateIso,
      };
      saveToDisk("ReportsTc003Data", args);
      return new ReportsTc003Data(
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
