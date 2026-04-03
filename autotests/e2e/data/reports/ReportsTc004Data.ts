declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithClosedPeriod } from "./queries/reportQueries";

interface Tc004Args {
  username: string;
  periodStart: string;
  taskName: string;
  closedDateLabel: string;
  closedDateIso: string;
}

/**
 * TC-RPT-004: Report in closed period — blocked.
 * Needs an employee whose office report period start leaves some past weeks closed.
 * We navigate to a week BEFORE periodStart and verify cells are non-editable.
 */
export class ReportsTc004Data {
  readonly username: string;
  readonly periodStart: string;
  readonly taskName: string;
  readonly taskPattern: RegExp;
  readonly closedDateLabel: string;
  readonly closedDateIso: string;

  constructor(
    username = process.env.RPT_TC004_USER ?? "pvaynmaster",
    periodStart = "2026-03-01",
    taskName = "Development",
    closedDateLabel = "23.02",
    closedDateIso = "2026-02-23",
  ) {
    this.username = username;
    this.periodStart = periodStart;
    this.taskName = taskName;
    const shortName = taskName.substring(0, 40);
    this.taskPattern = new RegExp(
      shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    this.closedDateLabel = closedDateLabel;
    this.closedDateIso = closedDateIso;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<ReportsTc004Data> {
    if (mode === "static") return new ReportsTc004Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc004Args>("ReportsTc004Data");
      if (cached) {
        return new ReportsTc004Data(
          cached.username,
          cached.periodStart,
          cached.taskName,
          cached.closedDateLabel,
          cached.closedDateIso,
        );
      }
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithClosedPeriod(db);
      // Calculate a Monday in the week before periodStart
      const ps = new Date(emp.periodStart);
      const closedDate = new Date(ps);
      closedDate.setDate(ps.getDate() - 7); // One week before period start
      // Align to Monday of that week
      const dow = closedDate.getDay();
      closedDate.setDate(closedDate.getDate() - (dow === 0 ? 6 : dow - 1));

      const dd = String(closedDate.getDate()).padStart(2, "0");
      const mm = String(closedDate.getMonth() + 1).padStart(2, "0");
      const yyyy = String(closedDate.getFullYear());
      const closedDateLabel = `${dd}.${mm}`;
      const closedDateIso = `${yyyy}-${mm}-${dd}`;

      const args: Tc004Args = {
        username: emp.login,
        periodStart: emp.periodStart,
        taskName: emp.taskName,
        closedDateLabel,
        closedDateIso,
      };
      if (mode === "saved") saveToDisk("ReportsTc004Data", args);
      return new ReportsTc004Data(
        args.username,
        args.periodStart,
        args.taskName,
        args.closedDateLabel,
        args.closedDateIso,
      );
    } finally {
      await db.close();
    }
  }
}
