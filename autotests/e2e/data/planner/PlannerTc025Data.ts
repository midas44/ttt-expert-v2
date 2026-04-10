declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findPMWithTwoEmployees } from "./queries/plannerQueries";

interface Tc025Args {
  username: string;
  projectName: string;
  employeeAName: string;
  employeeBName: string;
  daysBack: number;
}

/**
 * TC-PLN-025: Bug #3314 — task order preserved after 'Open for Editing' toggle.
 * Needs a PM with a project that has 2 different employees each with assignments.
 */
export class PlannerTc025Data {
  readonly username: string;
  readonly projectName: string;
  readonly employeeAName: string;
  readonly employeeBName: string;
  readonly daysBack: number;

  constructor(
    username = process.env.PLN_TC025_USER ?? "pvaynmaster",
    projectName = "Noveo",
    employeeAName = "Employee A",
    employeeBName = "Employee B",
    daysBack = 0,
  ) {
    this.username = username;
    this.projectName = projectName;
    this.employeeAName = employeeAName;
    this.employeeBName = employeeBName;
    this.daysBack = daysBack;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc025Data> {
    if (mode === "static") return new PlannerTc025Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc025Args>("PlannerTc025Data");
      if (cached)
        return new PlannerTc025Data(
          cached.username,
          cached.projectName,
          cached.employeeAName,
          cached.employeeBName,
          cached.daysBack,
        );
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findPMWithTwoEmployees(db);
      const args: Tc025Args = {
        username: row.login,
        projectName: row.project_name,
        employeeAName: row.employee_a_name,
        employeeBName: row.employee_b_name,
        daysBack: row.days_back,
      };
      saveToDisk("PlannerTc025Data", args);
      return new PlannerTc025Data(
        args.username,
        args.projectName,
        args.employeeAName,
        args.employeeBName,
        args.daysBack,
      );
    } finally {
      await db.close();
    }
  }
}
