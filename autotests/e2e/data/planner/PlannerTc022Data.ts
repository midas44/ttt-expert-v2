declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "@common/config/configUtils";
import type { TttConfig } from "@ttt/config/tttConfig";
import { DbClient } from "@ttt/config/db/dbClient";
import { findProjectManagerWithEmployee } from "./queries/plannerQueries";

interface Tc022Args {
  username: string;
  projectName: string;
}

/**
 * TC-PLN-022: DnD handles only visible in editing mode.
 * Needs a PM with a project that has employee members with task assignments.
 */
export class PlannerTc022Data {
  readonly username: string;
  readonly projectName: string;

  constructor(
    username = process.env.PLN_TC022_USER ?? "pvaynmaster",
    projectName = "Noveo",
  ) {
    this.username = username;
    this.projectName = projectName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc022Data> {
    if (mode === "static") return new PlannerTc022Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc022Args>("PlannerTc022Data");
      if (cached)
        return new PlannerTc022Data(cached.username, cached.projectName);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectManagerWithEmployee(db);
      const args: Tc022Args = {
        username: row.login,
        projectName: row.project_name,
      };
      saveToDisk("PlannerTc022Data", args);
      return new PlannerTc022Data(args.username, args.projectName);
    } finally {
      await db.close();
    }
  }
}
