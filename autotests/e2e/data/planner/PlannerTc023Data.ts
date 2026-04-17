declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findPMWithDndReadyEmployee } from "./queries/plannerQueries";

interface Tc023Args {
  username: string;
  projectName: string;
  employeeName: string;
  daysBack: number;
}

/**
 * TC-PLN-023: DnD reorder persists after page reload.
 * Needs a PM with a project that has an employee with 3+ assignments on a recent weekday.
 */
export class PlannerTc023Data {
  readonly username: string;
  readonly projectName: string;
  readonly employeeName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC023_USER ?? "pvaynmaster",
    projectName = "Noveo",
    employeeName = "Test Employee",
    daysBack = 0,
  ) {
    this.username = username;
    this.projectName = projectName;
    this.employeeName = employeeName;
    this.daysBack = daysBack;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc023Data> {
    if (mode === "static") return new PlannerTc023Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc023Args>("PlannerTc023Data");
      if (cached)
        return new PlannerTc023Data(
          cached.username,
          cached.projectName,
          cached.employeeName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPMWithDndReadyEmployee(db);
      const args: Tc023Args = {
        username: row.login,
        projectName: row.project_name,
        employeeName: row.employee_name,
        daysBack: row.days_back,
      };
      saveToDisk("PlannerTc023Data", args);
      return new PlannerTc023Data(
        args.username,
        args.projectName,
        args.employeeName,
        args.daysBack,
      );
    } finally {
      await db.close();
    }
  }
}
