declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithAvailableTask } from "./queries/plannerQueries";

interface Tc012Args {
  username: string;
  projectName: string;
  taskName: string;
  daysBack: number;
}

/**
 * TC-PLN-012: Add task via search bar — happy path.
 * Needs an employee with a weekday assignment (so search bar renders)
 * and another task in the same project that can be added.
 */
export class PlannerTc012Data {
  readonly username: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC012_USER ?? "pvaynmaster",
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
  ): Promise<PlannerTc012Data> {
    if (mode === "static") return new PlannerTc012Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc012Args>("PlannerTc012Data");
      if (cached)
        return new PlannerTc012Data(
          cached.username,
          cached.projectName,
          cached.taskName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithAvailableTask(db);
      const args: Tc012Args = {
        username: row.login,
        projectName: row.project_name,
        taskName: row.task_name,
        daysBack: row.days_back,
      };
      if (mode === "saved") saveToDisk("PlannerTc012Data", args);
      return new PlannerTc012Data(
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
