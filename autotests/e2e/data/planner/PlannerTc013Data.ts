declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithTaskDetails } from "./queries/plannerQueries";

interface Tc013Args {
  username: string;
  projectName: string;
  taskName: string;
  daysBack: number;
}

/**
 * TC-PLN-013: Edit hours in effort cell — inline editing.
 * Needs an employee with an existing task assignment on a recent weekday.
 */
export class PlannerTc013Data {
  readonly username: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC013_USER ?? "pvaynmaster",
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
  ): Promise<PlannerTc013Data> {
    if (mode === "static") return new PlannerTc013Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc013Args>("PlannerTc013Data");
      if (cached)
        return new PlannerTc013Data(
          cached.username,
          cached.projectName,
          cached.taskName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithTaskDetails(db);
      const args: Tc013Args = {
        username: row.login,
        projectName: row.project_name,
        taskName: row.task_name,
        daysBack: row.days_back,
      };
      saveToDisk("PlannerTc013Data", args);
      return new PlannerTc013Data(
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
