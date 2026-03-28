declare const process: { env: Record<string, string | undefined> };

import { loadSaved, saveToDisk } from "../savedDataStore";
import type { TestDataMode } from "../../config/configUtils";
import type { TttConfig } from "../../config/tttConfig";
import { DbClient } from "../../config/db/dbClient";
import { findProjectWithTrackerInfo } from "./queries/plannerQueries";

interface Tc019Args {
  username: string;
  projectName: string;
}

/**
 * TC-PLN-019: Color coding — blocked (red) and done (green).
 * Needs a PM whose project has tasks with tracker ticket info (for color-coded statuses).
 */
export class PlannerTc019Data {
  readonly username: string;
  readonly projectName: string;

  constructor(
    username = process.env.PLN_TC019_USER ?? "pvaynmaster",
    projectName = "Noveo",
  ) {
    this.username = username;
    this.projectName = projectName;
  }

  static async create(
    mode: TestDataMode,
    tttConfig: TttConfig,
  ): Promise<PlannerTc019Data> {
    if (mode === "static") return new PlannerTc019Data();

    if (mode === "saved") {
      const cached = loadSaved<Tc019Args>("PlannerTc019Data");
      if (cached)
        return new PlannerTc019Data(cached.username, cached.projectName);
    }

    const db = new DbClient(tttConfig);
    try {
      const row = await findProjectWithTrackerInfo(db);
      const args: Tc019Args = {
        username: row.login,
        projectName: row.project_name,
      };
      if (mode === "saved") saveToDisk("PlannerTc019Data", args);
      return new PlannerTc019Data(args.username, args.projectName);
    } finally {
      await db.close();
    }
  }
}
