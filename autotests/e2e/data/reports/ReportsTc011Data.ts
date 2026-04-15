declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import {
  findEmployeeForReporting,
  getCurrentWeekday,
} from "./queries/reportQueries";

interface Tc011Args {
  username: string;
  taskName: string;
  dateLabel: string;
  dateIso: string;
}

/**
 * TC-RPT-011: TAB key stacking bug (regression #3398).
 * Verifies that pressing TAB in the task grid does not create
 * stacked/duplicate input fields. Same data needs as TC-RPT-001.
 */
export class ReportsTc011Data {
  readonly username: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly dateLabel: string;
  readonly dateIso: string;

  constructor(
    username = process.env.RPT_TC011_USER ?? "pvaynmaster",
    taskName = "Development",
    dateLabel = "27.03",
    dateIso = "2026-03-27",
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
  ): Promise<ReportsTc011Data> {
    if (mode === "static") return new ReportsTc011Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc011Args>("ReportsTc011Data");
      if (cached) {
        return new ReportsTc011Data(
          cached.username,
          cached.taskName,
          cached.dateLabel,
          cached.dateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      // Use Friday (offset 4) to avoid collision with other tests
      const { dateLabel, dateIso } = getCurrentWeekday(4);
      const emp = await findEmployeeForReporting(db, dateIso);
      const args: Tc011Args = {
        username: emp.login,
        taskName: emp.taskName,
        dateLabel,
        dateIso,
      };
      saveToDisk("ReportsTc011Data", args);
      return new ReportsTc011Data(
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
