declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeWithTaskDetails } from "./queries/plannerQueries";

interface Tc015Args {
  username: string;
  projectName: string;
  taskName: string;
  daysBack: number;
}

/**
 * TC-PLN-015: Edit remaining estimate.
 * Needs an employee with an assignment on a project with tracker.
 */
export class PlannerTc015Data {
  readonly username: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC015_USER ?? "pvaynmaster",
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
  ): Promise<PlannerTc015Data> {
    if (mode === "static") return new PlannerTc015Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc015Args>("PlannerTc015Data");
      if (cached)
        return new PlannerTc015Data(
          cached.username,
          cached.projectName,
          cached.taskName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithTaskDetails(db);
      const args: Tc015Args = {
        username: row.login,
        projectName: row.project_name,
        taskName: row.task_name,
        daysBack: row.days_back,
      };
      saveToDisk("PlannerTc015Data", args);
      return new PlannerTc015Data(
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
