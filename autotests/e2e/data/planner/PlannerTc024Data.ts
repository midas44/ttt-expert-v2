declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findPMWithDndReadyEmployee } from "./queries/plannerQueries";

interface Tc024Args {
  username: string;
  projectName: string;
  employeeName: string;
  daysBack: number;
}

/**
 * TC-PLN-024: Bug #3332 — DnD should not create duplicate task rows.
 * Needs a PM with a project that has an employee with 3+ assignments on a recent weekday.
 */
export class PlannerTc024Data {
  readonly username: string;
  readonly projectName: string;
  readonly employeeName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC024_USER ?? "pvaynmaster",
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
  ): Promise<PlannerTc024Data> {
    if (mode === "static") return new PlannerTc024Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc024Args>("PlannerTc024Data");
      if (cached)
        return new PlannerTc024Data(
          cached.username,
          cached.projectName,
          cached.employeeName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPMWithDndReadyEmployee(db);
      const args: Tc024Args = {
        username: row.login,
        projectName: row.project_name,
        employeeName: row.employee_name,
        daysBack: row.days_back,
      };
      saveToDisk("PlannerTc024Data", args);
      return new PlannerTc024Data(
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
