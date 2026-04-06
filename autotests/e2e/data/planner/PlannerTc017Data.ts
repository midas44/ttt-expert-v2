declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectManagerWithEmployee } from "./queries/plannerQueries";

interface Tc017Args {
  username: string;
  projectName: string;
  employeeName: string;
}

/**
 * TC-PLN-017: 'Open for editing' generates assignments for employee.
 * Needs a PM with a project that has employee members with task assignments.
 */
export class PlannerTc017Data {
  readonly username: string;
  readonly projectName: string;
  readonly employeeName: string;

  constructor(
    username = process.env.PLN_TC017_USER ?? "pvaynmaster",
    projectName = "Noveo",
    employeeName = "Test Employee",
  ) {
    this.username = username;
    this.projectName = projectName;
    this.employeeName = employeeName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc017Data> {
    if (mode === "static") return new PlannerTc017Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc017Args>("PlannerTc017Data");
      if (cached)
        return new PlannerTc017Data(
          cached.username,
          cached.projectName,
          cached.employeeName,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectManagerWithEmployee(db);
      const args: Tc017Args = {
        username: row.login,
        projectName: row.project_name,
        employeeName: row.employee_name,
      };
      saveToDisk("PlannerTc017Data", args);
      return new PlannerTc017Data(
        args.username,
        args.projectName,
        args.employeeName,
      );
    } finally {
      await db.close();
    }
  }
}
