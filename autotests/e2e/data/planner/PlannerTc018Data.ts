declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectManagerWithEmployee } from "./queries/plannerQueries";

interface Tc018Args {
  username: string;
  projectName: string;
  employeeName: string;
  daysBack: number;
}

/**
 * TC-PLN-018: Edit hours in Projects tab (manager view).
 * Needs a PM with editing mode active on an employee who has task assignments.
 */
export class PlannerTc018Data {
  readonly username: string;
  readonly projectName: string;
  readonly employeeName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC018_USER ?? "pvaynmaster",
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
  ): Promise<PlannerTc018Data> {
    if (mode === "static") return new PlannerTc018Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc018Args>("PlannerTc018Data");
      if (cached)
        return new PlannerTc018Data(
          cached.username,
          cached.projectName,
          cached.employeeName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectManagerWithEmployee(db);
      const args: Tc018Args = {
        username: row.login,
        projectName: row.project_name,
        employeeName: row.employee_name,
        daysBack: row.days_back,
      };
      saveToDisk("PlannerTc018Data", args);
      return new PlannerTc018Data(
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
