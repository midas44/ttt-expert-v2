declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findEmployeeWithDeletableAssignment } from "./queries/plannerQueries";

interface Tc016Args {
  username: string;
  projectName: string;
  taskName: string;
  daysBack: number;
}

/**
 * TC-PLN-016: Delete assignment.
 * Needs an employee with a non-readOnly task assignment on a recent weekday.
 */
export class PlannerTc016Data {
  readonly username: string;
  readonly projectName: string;
  readonly taskName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC016_USER ?? "pvaynmaster",
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
  ): Promise<PlannerTc016Data> {
    if (mode === "static") return new PlannerTc016Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc016Args>("PlannerTc016Data");
      if (cached)
        return new PlannerTc016Data(
          cached.username,
          cached.projectName,
          cached.taskName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findEmployeeWithDeletableAssignment(db);
      const args: Tc016Args = {
        username: row.login,
        projectName: row.project_name,
        taskName: row.task_name,
        daysBack: row.days_back,
      };
      saveToDisk("PlannerTc016Data", args);
      return new PlannerTc016Data(
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
