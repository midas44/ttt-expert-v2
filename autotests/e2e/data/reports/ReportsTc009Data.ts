declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import {
  findEmployeeWithMultipleTasks,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc009Args {
  username: string;
  task1Name: string;
  task2Name: string;
  mondayLabel: string;
  mondayIso: string;
  tuesdayLabel: string;
  tuesdayIso: string;
}

/**
 * TC-RPT-009: Batch create reports — multiple cells in one week.
 * Needs an employee with at least 2 tasks on their grid.
 * Fills Task1 Monday + Tuesday and Task2 Monday.
 */
export class ReportsTc009Data {
  readonly username: string;
  readonly task1Name: string;
  readonly task1Pattern: RegExp;
  readonly task2Name: string;
  readonly task2Pattern: RegExp;
  readonly mondayLabel: string;
  readonly mondayIso: string;
  readonly tuesdayLabel: string;
  readonly tuesdayIso: string;
  readonly hours1 = "4";
  readonly hours2 = "4";
  readonly hours3 = "2";

  constructor(
    username = process.env.RPT_TC009_USER ?? "pvaynmaster",
    task1Name = "Development",
    task2Name = "Meetings",
    mondayLabel = "23.03",
    mondayIso = "2026-03-23",
    tuesdayLabel = "24.03",
    tuesdayIso = "2026-03-24",
  ) {
    this.username = username;
    this.task1Name = task1Name;
    this.task1Pattern = new RegExp(
      task1Name.substring(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    this.task2Name = task2Name;
    this.task2Pattern = new RegExp(
      task2Name.substring(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    this.mondayLabel = mondayLabel;
    this.mondayIso = mondayIso;
    this.tuesdayLabel = tuesdayLabel;
    this.tuesdayIso = tuesdayIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc009Data> {
    if (mode === "static") return new ReportsTc009Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc009Args>("ReportsTc009Data");
      if (cached) {
        return new ReportsTc009Data(
          cached.username,
          cached.task1Name,
          cached.task2Name,
          cached.mondayLabel,
          cached.mondayIso,
          cached.tuesdayLabel,
          cached.tuesdayIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithMultipleTasks(db);
      const { dateLabel: mondayLabel, dateIso: mondayIso } = getCurrentWeekday(0);
      const { dateLabel: tuesdayLabel, dateIso: tuesdayIso } = getCurrentWeekday(1);
      const args: Tc009Args = {
        username: emp.login,
        task1Name: emp.task1Name,
        task2Name: emp.task2Name,
        mondayLabel,
        mondayIso,
        tuesdayLabel,
        tuesdayIso,
      };
      if (mode === "saved") saveToDisk("ReportsTc009Data", args);
      return new ReportsTc009Data(
        args.username,
        args.task1Name,
        args.task2Name,
        args.mondayLabel,
        args.mondayIso,
        args.tuesdayLabel,
        args.tuesdayIso,
      );
    } finally {
      await db.close();
    }
  }
}
