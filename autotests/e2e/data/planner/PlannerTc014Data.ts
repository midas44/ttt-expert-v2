declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithTaskDetails } from "./queries/plannerQueries";

interface Tc014Args {
  username: string;
  projectName: string;
  taskName: string;
  daysBack: number;
}

/**
 * TC-PLN-014: Edit comment in comment cell.
 * Needs an employee with an existing task assignment on a recent weekday.
 */
export class PlannerTc014Data {
  readonly username: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC014_USER ?? "pvaynmaster",
    projectName = "Noveo",
    taskName = "Management",
    daysBack = 0,
  ) {
    this.username = username;
    this.projectName = projectName;
    this.taskName = taskName;
    this.daysBack = daysBack;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc014Data> {
    if (mode === "static") return new PlannerTc014Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc014Args>("PlannerTc014Data");
      if (cached)
        return new PlannerTc014Data(
          cached.username,
          cached.projectName,
          cached.taskName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithTaskDetails(db);
      const args: Tc014Args = {
        username: row.login,
        projectName: row.project_name,
        taskName: row.task_name,
        daysBack: row.days_back,
      };
      if (mode === "saved") saveToDisk("PlannerTc014Data", args);
      return new PlannerTc014Data(
        args.username,
        args.projectName,
        args.taskName,
        args.daysBack,
      );
    } finally {
      await db.close();
    }
  }
}
