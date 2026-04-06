declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findEmployeeWithWeekdayAssignment } from "./queries/plannerQueries";

interface Tc006Args {
  username: string;
  projectName: string;
  daysBack: number;
}

/**
 * TC-PLN-006: Search for task by name.
 * Needs an employee with a task_assignment on a recent weekday.
 * The assignment must exist in DB (not auto-generated) so the search bar
 * renders instead of "Open for editing" button.
 */
export class PlannerTc006Data {
  readonly username: string;
  readonly projectName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC006_USER ?? "pvaynmaster",
    projectName = "Noveo",
    daysBack = 0,
  ) {
    this.username = username;
    this.projectName = projectName;
    this.daysBack = daysBack;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc006Data> {
    if (mode === "static") return new PlannerTc006Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc006Args>("PlannerTc006Data");
      if (cached)
        return new PlannerTc006Data(
          cached.username,
          cached.projectName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const emp = await findEmployeeWithWeekdayAssignment(db);
      const args: Tc006Args = {
        username: emp.login,
        projectName: emp.project_name,
        daysBack: emp.days_back,
      };
      saveToDisk("PlannerTc006Data", args);
      return new PlannerTc006Data(
        args.username,
        args.projectName,
        args.daysBack,
      );
    } finally {
      await db.close();
    }
  }
}
